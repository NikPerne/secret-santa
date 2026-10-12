import { Router, type RequestHandler } from 'express';
import mongoose from 'mongoose';
import { readFileSync } from 'node:fs';
import { v2 as cloudinary } from 'cloudinary';
import { adminEmails, cloudinaryEnabled, emailProvider, env, pushEnabled } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import {
  GalleryPhotoModel,
  GroupModel,
  MembershipModel,
  MessageModel,
  SystemStatModel,
  UserModel,
  WishlistItemModel,
  today,
} from '../models/index.js';
import { z } from 'zod';
import { adminMailLimiter } from '../middleware/rate-limit.js';
import { objectId, parse, trimmed } from '../middleware/validate.js';
import { sendPasswordLink } from '../services/password-links.js';
import { conflict, forbidden, notFound } from '../utils/http-error.js';

export const adminRouter = Router();

/** Free-tier limits the page compares against. */
const ATLAS_M0_BYTES = 512 * 1024 * 1024;

const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!adminEmails.has(currentUser(req).email)) throw forbidden('Admins only');
  next();
};
adminRouter.use(requireAdmin);

const pkgVersion = (() => {
  try {
    return (
      JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }
    ).version;
  } catch {
    return 'unknown';
  }
})();

async function database() {
  const stats = await mongoose.connection.db!.stats();
  const used = (stats.dataSize ?? 0) + (stats.indexSize ?? 0);
  const [users, groupsByStatus, memberships, wishes, messages, photos, pushSubs] = await Promise.all([
    UserModel.estimatedDocumentCount(),
    GroupModel.aggregate<{ _id: string; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    MembershipModel.estimatedDocumentCount(),
    WishlistItemModel.estimatedDocumentCount(),
    MessageModel.estimatedDocumentCount(),
    GalleryPhotoModel.estimatedDocumentCount(),
    UserModel.aggregate<{ n: number }>([
      { $group: { _id: null, n: { $sum: { $size: '$pushSubscriptions' } } } },
    ]),
  ]);
  return {
    usedBytes: used,
    limitBytes: ATLAS_M0_BYTES,
    dataBytes: stats.dataSize ?? 0,
    indexBytes: stats.indexSize ?? 0,
    storageBytes: stats.storageSize ?? 0,
    counts: {
      users,
      groups: Object.fromEntries(groupsByStatus.map((g) => [g._id, g.n])),
      memberships,
      wishes,
      messages,
      photos,
      pushSubscriptions: pushSubs[0]?.n ?? 0,
    },
  };
}

interface CloudinaryUsage {
  plan?: string;
  credits?: { usage?: number; limit?: number; used_percent?: number };
  storage?: { usage?: number };
  bandwidth?: { usage?: number };
  transformations?: { usage?: number };
  resources?: number;
}

async function images() {
  if (!cloudinaryEnabled) return { configured: false as const };
  try {
    const u = (await cloudinary.api.usage()) as CloudinaryUsage;
    return {
      configured: true as const,
      plan: u.plan ?? null,
      credits: {
        used: u.credits?.usage ?? null,
        limit: u.credits?.limit ?? null,
        percent: u.credits?.used_percent ?? null,
      },
      storageBytes: u.storage?.usage ?? null,
      bandwidthBytes: u.bandwidth?.usage ?? null,
      transformations: u.transformations?.usage ?? null,
      resources: u.resources ?? null,
    };
  } catch (err) {
    return { configured: true as const, error: (err as Error).message };
  }
}

async function email() {
  const days = Array.from({ length: 7 }, (_, i) => today(new Date(Date.now() - i * 24 * 3600 * 1000)));
  const stats = await SystemStatModel.find({
    _id: { $in: [...days.map((d) => `mail:${d}`), ...days.map((d) => `mailFailed:${d}`)] },
  });
  const value = (key: string) => Number(stats.find((s) => s._id === key)?.value ?? 0);
  return {
    provider: emailProvider,
    dailyLimit: env.EMAIL_DAILY_LIMIT,
    today: value(`mail:${days[0]}`),
    failedToday: value(`mailFailed:${days[0]}`),
    lastDays: days.map((d) => ({ day: d, sent: value(`mail:${d}`), failed: value(`mailFailed:${d}`) })),
  };
}

adminRouter.get('/health', async (_req, res) => {
  const [db, img, mail, job] = await Promise.all([
    database(),
    images(),
    email(),
    SystemStatModel.findById('job:daily'),
  ]);
  const mem = process.memoryUsage();
  res.json({
    generatedAt: new Date().toISOString(),
    server: {
      version: pkgVersion,
      node: process.version,
      env: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssBytes: mem.rss,
      // Render free instances have 512 MB of RAM.
      memoryLimitBytes: 512 * 1024 * 1024,
      keepAliveUrl:
        env.KEEP_ALIVE_URL === 'off' ? null : env.KEEP_ALIVE_URL || process.env.RENDER_EXTERNAL_URL || null,
    },
    database: db,
    images: img,
    email: mail,
    push: { configured: pushEnabled, subscriptions: db.counts.pushSubscriptions },
    dailyJob: job?.value ?? null,
    retentionDays: env.DATA_RETENTION_DAYS,
  });
});

/** Everyone with an account, for the user list on the admin page. */
adminRouter.get('/users', async (_req, res) => {
  const users = await UserModel.find({}, { name: 1, email: 1, language: 1, createdAt: 1, passwordHash: 1 })
    .sort({ name: 1 })
    .lean();
  res.json({
    users: users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      language: u.language,
      isAdmin: adminEmails.has(u.email),
      hasPassword: Boolean(u.passwordHash),
      createdAt: u.createdAt?.toISOString() ?? null,
    })),
  });
});

/** Registers a person and emails them a link to choose their password. */
adminRouter.post('/users', adminMailLimiter, async (req, res) => {
  const body = parse(
    z.object({
      name: trimmed(60).min(1),
      email: z.string().trim().toLowerCase().email().max(200),
      language: z.enum(['en', 'sl']).optional(),
    }),
    req.body,
  );
  if (await UserModel.exists({ email: body.email })) {
    throw conflict('email_taken', 'Someone already has an account with this email');
  }
  let user;
  try {
    user = await UserModel.create({ name: body.name, email: body.email, language: body.language ?? 'sl' });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw conflict('email_taken', 'Someone already has an account with this email');
    }
    throw err;
  }
  const { sent, devLink } = await sendPasswordLink(user, 'setup');
  res
    .status(201)
    .json({ user: { id: user.id as string, name: user.name, email: user.email }, sent, devLink });
});

/** Emails a password reset link (or a new setup link if they never set a password). */
adminRouter.post('/users/:userId/password-link', adminMailLimiter, async (req, res) => {
  const { userId } = parse(z.object({ userId: objectId }), req.params);
  const user = await UserModel.findById(userId).select('+passwordHash');
  if (!user) throw notFound('User not found');
  const purpose = user.passwordHash ? 'reset' : 'setup';
  const { sent, devLink } = await sendPasswordLink(user, purpose);
  res.json({ sent, purpose, devLink });
});

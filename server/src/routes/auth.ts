import { Router, type Response } from 'express';
import { z } from 'zod';
import { env, instantJoinEnabled, isProd, smtpEnabled } from '../config/env.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { parse, trimmed } from '../middleware/validate.js';
import { LoginTokenModel, UserModel, type UserDoc } from '../models/index.js';
import { sendEmail } from '../services/email.js';
import { templates } from '../services/email-templates.js';
import { findGroupByInvite, joinGroup } from '../services/membership.js';
import { deleteAccount } from '../services/account.js';
import { serializeUser } from '../services/serializers.js';
import {
  MAGIC_LINK_TTL_MS,
  SESSION_COOKIE,
  hashToken,
  randomToken,
  sessionCookieOptions,
  signSession,
} from '../services/tokens.js';
import { badRequest, forbidden } from '../utils/http-error.js';

export const authRouter = Router();

const email = z.string().trim().toLowerCase().email().max(200);
const name = trimmed(60).min(1);
const language = z.enum(['en', 'sl']);
const inviteCode = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/);
/** Only same-app relative paths, never `//host` or absolute URLs (open-redirect protection). */
const redirect = z
  .string()
  .max(300)
  .regex(/^\/(?!\/)[^\s\\]*$/);

const requestLinkSchema = z.object({
  email,
  name: name.optional(),
  language: language.optional(),
  inviteCode: inviteCode.optional(),
  redirect: redirect.optional(),
});

interface SignInInput {
  email: string;
  name?: string;
  language?: 'en' | 'sl';
  inviteCode?: string | null;
}

async function upsertUser(input: SignInInput): Promise<UserDoc> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) return existing;
  try {
    return await UserModel.create({
      email: input.email,
      name: input.name || input.email.split('@')[0],
      language: input.language ?? 'en',
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const user = await UserModel.findOne({ email: input.email });
      if (user) return user;
    }
    throw err;
  }
}

/** Creates the session for a verified user, joining the invited group when there is one. */
async function completeSignIn(res: Response, input: SignInInput) {
  const user = await upsertUser(input);
  let groupId: string | undefined;
  if (input.inviteCode) {
    const group = await findGroupByInvite(input.inviteCode);
    await joinGroup(user, group);
    groupId = group.id;
  }
  res.cookie(SESSION_COOKIE, signSession(user.id), sessionCookieOptions());
  return { user: serializeUser(user), groupId };
}

/** Sends a magic link. Always answers the same way so it can't be used to probe emails. */
authRouter.post('/request-link', authLimiter, async (req, res) => {
  const body = parse(requestLinkSchema, req.body);
  if (body.inviteCode) await findGroupByInvite(body.inviteCode);

  const token = randomToken();
  await LoginTokenModel.create({
    tokenHash: hashToken(token),
    email: body.email,
    name: body.name,
    language: body.language,
    inviteCode: body.inviteCode,
    redirect: body.redirect,
    expiresAt: new Date(Date.now() + MAGIC_LINK_TTL_MS),
  });

  const existing = await UserModel.findOne({ email: body.email }, { name: 1, language: 1 });
  const link = `${env.CLIENT_URL}/auth/verify?token=${encodeURIComponent(token)}`;
  const lang = existing?.language ?? body.language;
  await sendEmail(
    body.email,
    templates(lang).magicLink(existing?.name ?? body.name ?? body.email.split('@')[0], link),
  );

  // Convenience for local development without SMTP: hand the link back directly.
  const devLink = !isProd && !smtpEnabled ? link : undefined;
  res.json({ sent: true, devLink });
});

authRouter.post('/verify', authLimiter, async (req, res) => {
  const { token } = parse(z.object({ token: z.string().min(10).max(200) }), req.body);
  // Atomic single use: only one request can flip usedAt from null.
  const record = await LoginTokenModel.findOneAndUpdate(
    { tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' },
  );
  if (!record) throw badRequest('invalid_token', 'This sign-in link is invalid or has expired');

  const result = await completeSignIn(res, {
    email: record.email,
    name: record.name ?? undefined,
    language: (record.language as 'en' | 'sl' | null) ?? undefined,
    inviteCode: record.inviteCode,
  });
  res.json({ ...result, redirect: record.redirect ?? undefined });
});

/** Development only: sign in / join instantly without an email round-trip. */
authRouter.post('/dev-login', async (req, res) => {
  if (!instantJoinEnabled) throw forbidden('Instant join is disabled');
  const body = parse(
    z.object({
      email,
      name: name.optional(),
      language: language.optional(),
      inviteCode: inviteCode.optional(),
    }),
    req.body,
  );
  res.json(await completeSignIn(res, body));
});

authRouter.get('/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.user ? serializeUser(req.user) : null });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.json({ ok: true });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      name: name.optional(),
      language: language.optional(),
      emailNotifications: z.boolean().optional(),
    }),
    req.body,
  );
  Object.assign(user, body);
  await user.save();
  res.json({ user: serializeUser(user) });
});

/** "Delete my data" */
authRouter.delete('/me', requireAuth, async (req, res) => {
  await deleteAccount(currentUser(req));
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.json({ ok: true });
});

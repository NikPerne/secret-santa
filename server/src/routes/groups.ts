import { Router } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import { inviteLimiter } from '../middleware/rate-limit.js';
import { groupCtx, requireOrganizer } from '../middleware/group.js';
import { imageInput, objectId, parse, trimmed } from '../middleware/validate.js';
import { GroupModel, MembershipModel, THEME_PRESETS, UserModel } from '../models/index.js';
import { isOwnedImage, deleteImages } from '../services/cloudinary.js';
import { sendEmail } from '../services/email.js';
import { templates } from '../services/email-templates.js';
import { deleteGroupData } from '../services/group-data.js';
import { createInviteCode } from '../services/membership.js';
import { serializeGroup, serializeMyMembership } from '../services/serializers.js';
import { unreadCounts } from '../services/unread.js';
import { badRequest, conflict } from '../utils/http-error.js';

/**
 * Exchange dates are calendar days ("2026-12-24"). They're stored at 12:00 UTC so the same day
 * shows everywhere from UTC-11 to UTC+11 and the .ics all-day event lands on the right date.
 */
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}/, 'Expected a date like 2026-12-24')
  .refine((v) => !Number.isNaN(Date.parse(v.slice(0, 10))), 'Invalid date')
  .transform((v) => new Date(`${v.slice(0, 10)}T12:00:00Z`));

const settingsInput = z
  .object({
    organizerSeesPairs: z.boolean(),
    organizerParticipates: z.boolean(),
    allowShippingAddress: z.boolean(),
    bigRevealAfterExchange: z.boolean(),
    avoidPreviousPairs: z.boolean(),
  })
  .partial();

const groupInput = z.object({
  name: trimmed(80).min(1),
  description: trimmed(1000).optional(),
  exchangeDate: dateInput.nullable().optional(),
  budget: z
    .object({
      amount: z.number().min(0).max(1_000_000).nullable().optional(),
      currency: z
        .string()
        .trim()
        .regex(/^[A-Za-z]{3}$/)
        .transform((v) => v.toUpperCase())
        .optional(),
    })
    .optional(),
  location: trimmed(200).optional(),
  settings: settingsInput.optional(),
  theme: z.object({ preset: z.enum(THEME_PRESETS), text: trimmed(200).optional() }).optional(),
});

/** Members list visible to everyone in the group: names only, no pairing information. */
async function listMembers(groupId: Types.ObjectId) {
  const memberships = await MembershipModel.find({ groupId }).sort({ joinedAt: 1 });
  const users = await UserModel.find(
    { _id: { $in: memberships.map((m) => m.userId) } },
    { name: 1, avatar: 1 },
  );
  const byId = new Map(users.map((u) => [u.id as string, u]));
  return memberships.map((m) => ({
    id: String(m.userId),
    name: byId.get(String(m.userId))?.name ?? '?',
    avatarUrl: byId.get(String(m.userId))?.avatar?.url ?? null,
    role: m.role,
    participates: m.participates,
  }));
}

// ---------- /api/groups ----------
export const groupsRouter = Router();

groupsRouter.get('/', async (req, res) => {
  const user = currentUser(req);
  const memberships = await MembershipModel.find({ userId: user._id });
  const groups = await GroupModel.find({ _id: { $in: memberships.map((m) => m.groupId) } }).sort({
    exchangeDate: -1,
    createdAt: -1,
  });
  const counts = await MembershipModel.aggregate<{ _id: unknown; n: number }>([
    { $match: { groupId: { $in: groups.map((g) => g._id) } } },
    { $group: { _id: '$groupId', n: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
  const byGroup = new Map(memberships.map((m) => [String(m.groupId), m]));
  const unread = await Promise.all(
    groups.map(async (g) => {
      const m = byGroup.get(g.id);
      if (!m) return 0;
      const counts = await unreadCounts(g, m);
      return counts.match + counts.santa;
    }),
  );
  res.json({
    groups: groups.map((g, i) => ({
      ...serializeGroup(g, byGroup.get(g.id)),
      role: byGroup.get(g.id)?.role,
      memberCount: countMap.get(g.id) ?? 0,
      unread: unread[i],
    })),
  });
});

groupsRouter.post('/', async (req, res) => {
  const user = currentUser(req);
  const body = parse(groupInput, req.body);
  const group = await GroupModel.create({
    ...body,
    budget: { amount: body.budget?.amount ?? null, currency: body.budget?.currency ?? 'EUR' },
    organizerId: user._id,
    inviteCode: await createInviteCode(),
  });
  const membership = await MembershipModel.create({
    groupId: group._id,
    userId: user._id,
    role: 'organizer',
    participates: group.settings?.organizerParticipates ?? true,
  });
  res.status(201).json({ group: serializeGroup(group, membership) });
});

// ---------- /api/groups/:groupId ----------
/** Mounted after requireAuth + loadGroupMembership (see app.ts). */
export const groupRouter = Router({ mergeParams: true });

groupRouter.get('/', async (req, res) => {
  const { group, membership } = groupCtx(req);
  res.json({
    group: serializeGroup(group, membership),
    me: serializeMyMembership(membership),
    members: await listMembers(group._id),
  });
});

groupRouter.patch('/', requireOrganizer, async (req, res) => {
  const { group, membership } = groupCtx(req);
  const body = parse(groupInput.partial().extend({ coverImage: imageInput.nullable().optional() }), req.body);

  if (body.coverImage !== undefined) {
    if (body.coverImage && !isOwnedImage(body.coverImage, group.id)) {
      throw badRequest('invalid_image', 'Image must be uploaded through the app');
    }
    const old = group.coverImage?.publicId;
    if (old && old !== body.coverImage?.publicId) await deleteImages([old]);
    group.set('coverImage', body.coverImage);
  }
  if (body.settings?.organizerParticipates !== undefined) {
    const current = group.settings?.organizerParticipates ?? true;
    if (body.settings.organizerParticipates !== current) {
      if (group.status !== 'open') {
        throw conflict('already_drawn', 'Redo the draw to change whether the organizer takes part');
      }
      membership.participates = body.settings.organizerParticipates;
      await membership.save();
    }
  }
  const { settings, budget, coverImage: _cover, ...rest } = body;
  group.set(rest);
  if (settings) group.set('settings', { ...group.toObject().settings, ...settings });
  if (budget) group.set('budget', { ...group.toObject().budget, ...budget });
  await group.save();
  res.json({ group: serializeGroup(group, membership) });
});

groupRouter.delete('/', requireOrganizer, async (req, res) => {
  const { group } = groupCtx(req);
  await deleteGroupData(group._id);
  res.json({ ok: true });
});

groupRouter.put('/exclusions', requireOrganizer, async (req, res) => {
  const { group, membership } = groupCtx(req);
  const { exclusions } = parse(
    z.object({ exclusions: z.array(z.object({ a: objectId, b: objectId })).max(500) }),
    req.body,
  );
  const memberIds = new Set(
    (await MembershipModel.find({ groupId: group._id }, { userId: 1 })).map((m) => String(m.userId)),
  );
  const seen = new Set<string>();
  const clean: Array<{ a: string; b: string }> = [];
  for (const { a, b } of exclusions) {
    if (a === b) throw badRequest('invalid_exclusion', 'A person cannot be excluded from themselves');
    if (!memberIds.has(a) || !memberIds.has(b)) {
      throw badRequest('invalid_exclusion', 'Exclusions can only use group members');
    }
    const key = [a, b].sort().join(':');
    if (!seen.has(key)) {
      seen.add(key);
      clean.push({ a, b });
    }
  }
  group.set('exclusions', clean);
  await group.save();
  res.json({ group: serializeGroup(group, membership) });
});

groupRouter.patch('/me', async (req, res) => {
  const { group, membership } = groupCtx(req);
  const body = parse(
    z.object({
      giftStatus: z.enum(['none', 'bought', 'delivered']).optional(),
      shippingAddress: trimmed(500).optional(),
    }),
    req.body,
  );
  if (body.shippingAddress !== undefined && !group.settings?.allowShippingAddress) {
    throw badRequest('shipping_disabled', 'Shipping addresses are not enabled for this group');
  }
  membership.set(body);
  await membership.save();
  res.json({ me: serializeMyMembership(membership) });
});

/** Organizer emails the invite link to a few addresses (skips people already in the group). */
groupRouter.post('/invite-emails', requireOrganizer, inviteLimiter, async (req, res) => {
  const { group, user } = groupCtx(req);
  if (group.status === 'finished') throw conflict('group_finished', 'This group has already finished');
  const { emails } = parse(
    z.object({ emails: z.array(z.string().trim().toLowerCase().email().max(200)).min(1).max(30) }),
    req.body,
  );
  const unique = [...new Set(emails)];
  const existing = await UserModel.find({ email: { $in: unique } }, { email: 1 });
  const memberIds = new Set(
    (await MembershipModel.find({ groupId: group._id, userId: { $in: existing.map((u) => u._id) } })).map(
      (m) => String(m.userId),
    ),
  );
  const alreadyIn = new Set(existing.filter((u) => memberIds.has(u.id)).map((u) => u.email));
  const link = `${env.CLIENT_URL}/join/${group.inviteCode}`;
  let sent = 0;
  for (const email of unique) {
    if (alreadyIn.has(email)) continue;
    if (await sendEmail(email, templates(user.language).invite(user.name, group.name, link))) sent++;
  }
  res.json({ sent, skipped: alreadyIn.size });
});

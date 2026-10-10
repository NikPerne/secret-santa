import { Router } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { currentUser } from '../middleware/auth.js';
import { groupCtx, requireOrganizer } from '../middleware/group.js';
import { imageInput, objectId, parse, trimmed } from '../middleware/validate.js';
import { GroupModel, MembershipModel, UserModel } from '../models/index.js';
import { isOwnedImage, deleteImages } from '../services/cloudinary.js';
import { deleteGroupData } from '../services/group-data.js';
import { createInviteCode } from '../services/membership.js';
import { serializeGroup, serializeMyMembership } from '../services/serializers.js';
import { badRequest, conflict } from '../utils/http-error.js';

const dateInput = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date')
  .transform((v) => new Date(v));

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
});

/** Members list visible to everyone in the group: names only, no pairing information. */
async function listMembers(groupId: Types.ObjectId) {
  const memberships = await MembershipModel.find({ groupId }).sort({ joinedAt: 1 });
  const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.userId) } }, { name: 1 });
  const names = new Map(users.map((u) => [u.id as string, u.name]));
  return memberships.map((m) => ({
    id: String(m.userId),
    name: names.get(String(m.userId)) ?? '?',
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
  res.json({
    groups: groups.map((g) => ({
      ...serializeGroup(g, byGroup.get(g.id)),
      role: byGroup.get(g.id)?.role,
      memberCount: countMap.get(g.id) ?? 0,
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

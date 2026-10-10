import { Router } from 'express';
import { z } from 'zod';
import { groupCtx, requireOrganizer } from '../middleware/group.js';
import { objectId, parse } from '../middleware/validate.js';
import {
  AssignmentModel,
  GroupModel,
  MembershipModel,
  PreferencesModel,
  UserModel,
  WishlistItemModel,
  claimNotification,
  type GroupDoc,
  type MembershipDoc,
} from '../models/index.js';
import { DrawImpossibleError } from '../services/draw.js';
import { feasibilityFor, loadPairs, removeMember, runDraw } from '../services/draw-runner.js';
import { createInviteCode } from '../services/membership.js';
import { notifyUser } from '../services/notify.js';
import { exchangePassed, serializeGroup } from '../services/serializers.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error.js';

export const drawRouter = Router({ mergeParams: true });

/** Organizer may see pairs if they enabled it, or if they aren't playing themselves. */
export const organizerCanSeePairs = (group: GroupDoc) =>
  Boolean(group.settings?.organizerSeesPairs) || group.settings?.organizerParticipates === false;

async function myAssignment(group: GroupDoc, membership: MembershipDoc) {
  if (group.status === 'open') throw conflict('not_drawn', 'Names have not been drawn yet');
  if (!membership.participates) throw notFound('You are not taking part in this draw');
  const assignment = await AssignmentModel.findOne({ groupId: group._id, giverId: membership.userId });
  if (!assignment) throw notFound('No match yet');
  return assignment;
}

// ---------- Draw (organizer) ----------
drawRouter.get('/draw/check', requireOrganizer, async (req, res) => {
  const { group } = groupCtx(req);
  res.json(await feasibilityFor(group));
});

drawRouter.post('/draw', requireOrganizer, async (req, res) => {
  const { group, membership } = groupCtx(req);
  parse(z.object({ confirm: z.literal(true) }), req.body);
  if (group.status === 'finished') throw conflict('group_finished', 'This group has already finished');
  try {
    const result = await runDraw(group);
    res.json({ ...result, group: serializeGroup(group, membership) });
  } catch (err) {
    if (err instanceof DrawImpossibleError) {
      throw conflict('draw_impossible', err.message, { code: err.code, people: err.people });
    }
    throw err;
  }
});

// ---------- My match ----------
drawRouter.get('/match', async (req, res) => {
  const { group, membership } = groupCtx(req);
  const assignment = await myAssignment(group, membership);
  const [receiver, receiverMembership] = await Promise.all([
    UserModel.findById(assignment.receiverId, { name: 1 }),
    MembershipModel.findOne({ groupId: group._id, userId: assignment.receiverId }, { shippingAddress: 1 }),
  ]);
  res.json({
    match: {
      id: String(assignment.receiverId),
      name: receiver?.name ?? '?',
      shippingAddress: group.settings?.allowShippingAddress
        ? receiverMembership?.shippingAddress || null
        : null,
    },
    viewedAt: membership.viewedMatchAt?.toISOString() ?? null,
  });
});

drawRouter.post('/match/viewed', async (req, res) => {
  const { group, membership } = groupCtx(req);
  await myAssignment(group, membership);
  if (!membership.viewedMatchAt) {
    membership.viewedMatchAt = new Date();
    await membership.save();
  }
  res.json({ viewedAt: membership.viewedMatchAt.toISOString() });
});

/** The big reveal: who was my Santa? Only after the exchange, and only if the group allows it. */
drawRouter.get('/my-santa', async (req, res) => {
  const { group, membership } = groupCtx(req);
  if (!group.settings?.bigRevealAfterExchange || !exchangePassed(group)) {
    throw forbidden('Your Santa stays secret for now');
  }
  const assignment = await AssignmentModel.findOne({ groupId: group._id, receiverId: membership.userId });
  if (!assignment) throw notFound('No Santa found');
  const santa = await UserModel.findById(assignment.giverId, { name: 1 });
  res.json({ santa: { name: santa?.name ?? '?' } });
});

// ---------- Organizer dashboard ----------
drawRouter.get('/dashboard', requireOrganizer, async (req, res) => {
  const { group, membership } = groupCtx(req);
  const memberships = await MembershipModel.find({ groupId: group._id }).sort({ joinedAt: 1 });
  const userIds = memberships.map((m) => m.userId);
  const [users, wishlistCounts, prefs, assignments] = await Promise.all([
    UserModel.find({ _id: { $in: userIds } }, { name: 1, email: 1 }),
    WishlistItemModel.aggregate<{ _id: unknown; n: number }>([
      { $match: { groupId: group._id } },
      { $group: { _id: '$userId', n: { $sum: 1 } } },
    ]),
    PreferencesModel.find({ groupId: group._id }, { userId: 1, sizes: 1, likes: 1, dislikes: 1 }),
    AssignmentModel.find({ groupId: group._id }, { giverId: 1 }),
  ]);
  const userMap = new Map(users.map((u) => [u.id as string, u]));
  const wishMap = new Map(wishlistCounts.map((w) => [String(w._id), w.n]));
  const prefSet = new Set(prefs.filter((p) => p.sizes || p.likes || p.dislikes).map((p) => String(p.userId)));
  const hasMatch = new Set(assignments.map((a) => String(a.giverId)));

  res.json({
    group: serializeGroup(group, membership),
    canSeePairs: organizerCanSeePairs(group),
    feasibility: group.status === 'open' ? await feasibilityFor(group) : null,
    members: memberships.map((m) => {
      const id = String(m.userId);
      const user = userMap.get(id);
      return {
        id,
        name: user?.name ?? '?',
        email: user?.email ?? '',
        role: m.role,
        participates: m.participates,
        joinedAt: m.joinedAt.toISOString(),
        hasMatch: hasMatch.has(id),
        viewedMatch: Boolean(m.viewedMatchAt),
        wishlistCount: wishMap.get(id) ?? 0,
        hasPreferences: prefSet.has(id),
        giftStatus: m.giftStatus,
      };
    }),
  });
});

drawRouter.get('/pairs', requireOrganizer, async (req, res) => {
  const { group } = groupCtx(req);
  if (!organizerCanSeePairs(group)) {
    throw forbidden('Turn on "let the organizer see pairs" in the group settings first');
  }
  const pairs = await loadPairs(group._id);
  const users = await UserModel.find({ _id: { $in: [...pairs.keys()] } }, { name: 1 });
  const names = new Map(users.map((u) => [u.id as string, u.name]));
  res.json({
    pairs: [...pairs].map(([g, r]) => ({
      giver: { id: g, name: names.get(g) ?? '?' },
      receiver: { id: r, name: names.get(r) ?? '?' },
    })),
  });
});

drawRouter.delete('/members/:userId', requireOrganizer, async (req, res) => {
  const { group, user } = groupCtx(req);
  const { userId } = parse(z.object({ userId: objectId }), req.params);
  if (userId === user.id)
    throw badRequest('cannot_remove_self', 'Delete the group instead of removing yourself');
  const { changed } = await removeMember(group, userId);
  res.json({ ok: true, changedCount: changed.length });
});

drawRouter.post('/leave', async (req, res) => {
  const { group, user, isOrganizer } = groupCtx(req);
  if (isOrganizer) throw badRequest('organizer_cannot_leave', 'The organizer can delete the group instead');
  await removeMember(group, user.id);
  res.json({ ok: true });
});

/** "Same again next year": copies settings, rules and members into a new open group. */
drawRouter.post('/duplicate', requireOrganizer, async (req, res) => {
  const { group, user } = groupCtx(req);
  const body = parse(z.object({ name: z.string().trim().min(1).max(80).optional() }), req.body ?? {});
  const nextDate = group.exchangeDate ? new Date(group.exchangeDate) : null;
  nextDate?.setFullYear(nextDate.getFullYear() + 1);

  const copy = await GroupModel.create({
    name: body.name ?? group.name,
    description: group.description,
    exchangeDate: nextDate,
    budget: group.toObject().budget,
    location: group.location,
    organizerId: user._id,
    inviteCode: await createInviteCode(),
    settings: { ...group.toObject().settings, avoidPreviousPairs: true },
    exclusions: group.exclusions,
    previousGroupId: group._id,
  });
  const memberships = await MembershipModel.find({ groupId: group._id });
  await MembershipModel.insertMany(
    memberships.map((m) => ({
      groupId: copy._id,
      userId: m.userId,
      role: m.role,
      participates: m.participates,
    })),
  );
  res.status(201).json({
    group: serializeGroup(
      copy,
      memberships.find((m) => m.role === 'organizer'),
    ),
  });
});

/**
 * Organizer nudge: reminds someone who hasn't unwrapped their match (or has an empty wishlist)
 * by email and push. At most once per person per day.
 */
drawRouter.post('/members/:userId/nudge', requireOrganizer, async (req, res) => {
  const { group } = groupCtx(req);
  const { userId } = parse(z.object({ userId: objectId }), req.params);
  const [target, user, wishes] = await Promise.all([
    MembershipModel.findOne({ groupId: group._id, userId }),
    UserModel.findById(userId),
    WishlistItemModel.countDocuments({ groupId: group._id, userId }),
  ]);
  if (!target || !user || !target.participates) throw notFound('Member not found');

  const kind =
    group.status === 'drawn' && !target.viewedMatchAt
      ? 'nudgeReveal'
      : wishes === 0
        ? 'wishlistMissing'
        : null;
  if (!kind) throw badRequest('nothing_to_nudge', 'This person is all set');

  const day = new Date().toISOString().slice(0, 10);
  if (!(await claimNotification(`nudge:${group.id}:${userId}:${day}`, group._id))) {
    throw conflict('already_nudged', 'Already reminded today');
  }
  await notifyUser(user, kind, group);
  res.json({ ok: true, kind });
});

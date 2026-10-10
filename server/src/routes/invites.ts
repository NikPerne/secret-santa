import { Router } from 'express';
import { z } from 'zod';
import { instantJoinEnabled } from '../config/env.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { MembershipModel, UserModel } from '../models/index.js';
import { findGroupByInvite, joinGroup } from '../services/membership.js';
import { serializeImage } from '../services/serializers.js';

export const invitesRouter = Router();

const codeParam = z.object({
  code: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/),
});

/** Public preview shown on the join page. Contains no member details beyond the organizer's name. */
invitesRouter.get('/:code', async (req, res) => {
  const { code } = parse(codeParam, req.params);
  const group = await findGroupByInvite(code);
  const [organizer, memberCount, alreadyMember] = await Promise.all([
    UserModel.findById(group.organizerId, { name: 1 }),
    MembershipModel.countDocuments({ groupId: group._id }),
    req.user ? MembershipModel.exists({ groupId: group._id, userId: req.user._id }) : null,
  ]);
  res.json({
    invite: {
      groupId: alreadyMember ? group.id : undefined,
      name: group.name,
      description: group.description,
      coverImage: serializeImage(group.coverImage),
      exchangeDate: group.exchangeDate?.toISOString() ?? null,
      budget: { amount: group.budget?.amount ?? null, currency: group.budget?.currency ?? 'EUR' },
      location: group.location,
      theme: { preset: group.theme?.preset ?? 'none', text: group.theme?.text ?? '' },
      status: group.status,
      organizerName: organizer?.name ?? '',
      memberCount,
      alreadyMember: Boolean(alreadyMember),
    },
    instantJoin: instantJoinEnabled,
  });
});

/** Join as the signed-in user. */
invitesRouter.post('/:code/join', requireAuth, async (req, res) => {
  const { code } = parse(codeParam, req.params);
  const user = currentUser(req);
  const group = await findGroupByInvite(code);
  const { joined } = await joinGroup(user, group);
  res.json({ groupId: group.id, joined });
});

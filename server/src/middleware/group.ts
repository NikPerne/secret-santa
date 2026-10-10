import type { Request, RequestHandler } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  GroupModel,
  MembershipModel,
  type GroupDoc,
  type MembershipDoc,
  type UserDoc,
} from '../models/index.js';
import { forbidden, notFound } from '../utils/http-error.js';
import { currentUser } from './auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    group?: GroupDoc;
    membership?: MembershipDoc;
  }
}

/**
 * Loads `:groupId` and the caller's membership. Non-members get a 404 so group ids can't be probed.
 */
export const loadGroupMembership: RequestHandler = async (req, _res, next) => {
  const user = currentUser(req);
  const groupId = req.params.groupId;
  if (typeof groupId !== 'string' || !isValidObjectId(groupId)) throw notFound('Group not found');
  const [group, membership] = await Promise.all([
    GroupModel.findById(groupId),
    MembershipModel.findOne({ groupId, userId: user._id }),
  ]);
  if (!group || !membership) throw notFound('Group not found');
  req.group = group;
  req.membership = membership;
  next();
};

export const requireOrganizer: RequestHandler = (req, _res, next) => {
  if (req.membership?.role !== 'organizer') throw forbidden('Only the organizer can do this');
  next();
};

export interface GroupContext {
  user: UserDoc;
  group: GroupDoc;
  membership: MembershipDoc;
  isOrganizer: boolean;
}

/** Typed accessor for routes behind `loadGroupMembership`. */
export function groupCtx(req: Request): GroupContext {
  const user = currentUser(req);
  if (!req.group || !req.membership) throw notFound('Group not found');
  return {
    user,
    group: req.group,
    membership: req.membership,
    isOrganizer: req.membership.role === 'organizer',
  };
}

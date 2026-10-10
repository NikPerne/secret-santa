import { GroupModel, MembershipModel, type GroupDoc, type UserDoc } from '../models/index.js';
import { conflict, notFound } from '../utils/http-error.js';

export async function findGroupByInvite(code: string): Promise<GroupDoc> {
  const group = await GroupModel.findOne({ inviteCode: code });
  if (!group) throw notFound('This invite link is not valid');
  return group;
}

/**
 * Adds a user to a group. Joining is idempotent. Joining after the draw is handled by
 * `onJoinAfterDraw` (inserts the newcomer into the existing assignments).
 */
export async function joinGroup(user: UserDoc, group: GroupDoc): Promise<{ joined: boolean }> {
  const existing = await MembershipModel.findOne({ groupId: group._id, userId: user._id });
  if (existing) return { joined: false };
  if (group.status === 'finished') throw conflict('group_finished', 'This group has already finished');
  if (group.status === 'drawn' && !joinAfterDrawHook) {
    throw conflict('already_drawn', 'Names have already been drawn in this group');
  }
  try {
    await MembershipModel.create({ groupId: group._id, userId: user._id, role: 'participant' });
  } catch (err) {
    // Concurrent double-join: the unique index already has us.
    if ((err as { code?: number }).code === 11000) return { joined: false };
    throw err;
  }
  if (group.status === 'drawn' && joinAfterDrawHook) await joinAfterDrawHook(group, user);
  return { joined: true };
}

type JoinAfterDrawHook = (group: GroupDoc, user: UserDoc) => Promise<void>;
let joinAfterDrawHook: JoinAfterDrawHook | undefined;

/** Registered by the draw module so membership doesn't depend on it directly. */
export function onJoinAfterDraw(hook: JoinAfterDrawHook): void {
  joinAfterDrawHook = hook;
}

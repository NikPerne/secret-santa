import type { Types } from 'mongoose';
import {
  AssignmentModel,
  GalleryPhotoModel,
  MembershipModel,
  MessageModel,
  PreferencesModel,
  UserModel,
  WishlistItemModel,
  threadKeyFor,
  type GroupDoc,
  type UserDoc,
} from '../models/index.js';
import { conflict } from '../utils/http-error.js';
import { logger } from '../utils/logger.js';
import { deleteImages } from './cloudinary.js';
import {
  DrawImpossibleError,
  checkFeasibility,
  draw,
  insertParticipant,
  reassign,
  type Feasibility,
  type Pairs,
} from './draw.js';
import { onJoinAfterDraw } from './membership.js';
import { notifyUsers } from './notify.js';

/** Persistence and side effects around the pure draw algorithm. */

export async function participantsOf(groupId: Types.ObjectId) {
  const memberships = await MembershipModel.find({ groupId, participates: true }).sort({ joinedAt: 1 });
  const ids = memberships.map((m) => String(m.userId));
  const users = await UserModel.find({ _id: { $in: ids } }, { name: 1 });
  const names = new Map(users.map((u) => [u.id as string, u.name]));
  return { ids, nameOf: (id: string) => names.get(id) ?? 'Someone' };
}

export async function loadPairs(groupId: Types.ObjectId): Promise<Pairs> {
  const rows = await AssignmentModel.find({ groupId });
  return new Map(rows.map((a) => [String(a.giverId), String(a.receiverId)]));
}

async function previousPairsFor(group: GroupDoc): Promise<Array<[string, string]> | undefined> {
  if (!group.previousGroupId || !(group.settings?.avoidPreviousPairs ?? true)) return undefined;
  const pairs = await loadPairs(group.previousGroupId);
  return pairs.size ? [...pairs] : undefined;
}

const exclusionsOf = (group: GroupDoc) => group.exclusions.map((e) => ({ a: String(e.a), b: String(e.b) }));

export async function feasibilityFor(group: GroupDoc): Promise<Feasibility & { participantCount: number }> {
  const { ids, nameOf } = await participantsOf(group._id);
  const result = checkFeasibility(ids, exclusionsOf(group), undefined, nameOf);
  return { ...result, participantCount: ids.length };
}

/** Replaces the changed givers' assignments (delete first so the unique indexes never clash). */
async function writeChanges(groupId: Types.ObjectId, pairs: Pairs, changed: string[]): Promise<void> {
  if (!changed.length) return;
  await AssignmentModel.deleteMany({ groupId, giverId: { $in: changed } });
  await AssignmentModel.insertMany(
    changed.filter((g) => pairs.has(g)).map((g) => ({ groupId, giverId: g, receiverId: pairs.get(g) })),
  );
}

/** Full (re)draw. Previous-year pairs are avoided when possible, otherwise ignored. */
export async function runDraw(group: GroupDoc): Promise<{ avoidedPreviousPairs: boolean | null }> {
  const { ids, nameOf } = await participantsOf(group._id);
  const exclusions = exclusionsOf(group);
  const previous = await previousPairsFor(group);

  let pairs: Pairs;
  let avoidedPreviousPairs: boolean | null = null;
  try {
    pairs = draw(ids, exclusions, previous, Math.random, nameOf);
    if (previous) avoidedPreviousPairs = true;
  } catch (err) {
    if (!(err instanceof DrawImpossibleError) || !previous) throw err;
    pairs = draw(ids, exclusions, undefined, Math.random, nameOf);
    avoidedPreviousPairs = false;
  }

  await AssignmentModel.deleteMany({ groupId: group._id });
  await AssignmentModel.insertMany(
    [...pairs].map(([g, r]) => ({ groupId: group._id, giverId: g, receiverId: r })),
  );
  // A redraw makes old chats and progress meaningless.
  await MessageModel.deleteMany({ groupId: group._id });
  await MembershipModel.updateMany(
    { groupId: group._id },
    { $set: { viewedMatchAt: null, giftStatus: 'none' } },
  );

  group.status = 'drawn';
  group.drawnAt = new Date();
  await group.save();

  void notifyUsers(ids, 'drawDone', group);
  return { avoidedPreviousPairs };
}

/**
 * Removes a member and their data. After the draw, their Santa gets a new receiver with as few
 * changes as possible, and everyone whose match changed is notified.
 */
export async function removeMember(group: GroupDoc, userId: string): Promise<{ changed: string[] }> {
  let changed: string[] = [];
  const groupId = group._id;
  const membership = await MembershipModel.findOne({ groupId, userId });
  if (!membership) return { changed };

  if (group.status === 'drawn' && membership.participates) {
    const current = await loadPairs(groupId);
    if (current.has(userId)) {
      const { nameOf } = await participantsOf(groupId);
      let result;
      try {
        result = reassign(current, userId, exclusionsOf(group), undefined, Math.random, nameOf);
      } catch (err) {
        if (err instanceof DrawImpossibleError)
          throw conflict('draw_impossible', err.message, { people: err.people });
        throw err;
      }
      changed = result.changed;
      // Old threads of givers whose receiver changed no longer make sense.
      const staleThreads = changed.map((g) => threadKeyFor(g, current.get(g)));
      await MessageModel.deleteMany({ groupId, threadKey: { $in: staleThreads } });
      await AssignmentModel.deleteMany({ groupId, $or: [{ giverId: userId }, { receiverId: userId }] });
      await writeChanges(groupId, result.pairs, changed);
      await MembershipModel.updateMany(
        { groupId, userId: { $in: changed } },
        { $set: { viewedMatchAt: null, giftStatus: 'none' } },
      );
    }
  }

  const items = await WishlistItemModel.find({ groupId, userId, image: { $ne: null } }, { image: 1 });
  const photos = await GalleryPhotoModel.find({ groupId, userId }, { image: 1 });
  await deleteImages([...items.map((i) => i.image?.publicId), ...photos.map((p) => p.image?.publicId)]);
  await Promise.all([
    WishlistItemModel.deleteMany({ groupId, userId }),
    PreferencesModel.deleteMany({ groupId, userId }),
    GalleryPhotoModel.deleteMany({ groupId, userId }),
    MessageModel.deleteMany({ groupId, threadKey: { $regex: `(^${userId}>)|(>${userId}$)` } }),
    AssignmentModel.deleteMany({ groupId, $or: [{ giverId: userId }, { receiverId: userId }] }),
    MembershipModel.deleteOne({ _id: membership._id }),
  ]);
  group.set(
    'exclusions',
    group.exclusions.filter((e) => String(e.a) !== userId && String(e.b) !== userId),
  );
  await group.save();

  void notifyUsers(changed, 'matchChanged', group);
  return { changed };
}

/** Slots a late joiner into an existing draw (registered as a membership hook). */
async function addLateJoiner(group: GroupDoc, user: UserDoc): Promise<void> {
  const current = await loadPairs(group._id);
  try {
    const { nameOf } = await participantsOf(group._id);
    const { pairs, changed } = insertParticipant(
      current,
      user.id,
      exclusionsOf(group),
      undefined,
      Math.random,
      nameOf,
    );
    const staleThreads = changed.filter((g) => current.has(g)).map((g) => threadKeyFor(g, current.get(g)));
    await MessageModel.deleteMany({ groupId: group._id, threadKey: { $in: staleThreads } });
    await writeChanges(group._id, pairs, changed);
    const others = changed.filter((g) => g !== user.id);
    await MembershipModel.updateMany(
      { groupId: group._id, userId: { $in: others } },
      { $set: { viewedMatchAt: null, giftStatus: 'none' } },
    );
    void notifyUsers(others, 'matchChanged', group);
    void notifyUsers([user.id], 'drawDone', group);
  } catch (err) {
    logger.error({ err, groupId: group.id }, 'Could not slot late joiner into the draw');
  }
}

onJoinAfterDraw(addLateJoiner);

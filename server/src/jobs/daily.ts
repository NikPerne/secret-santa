import cron from 'node-cron';
import { env } from '../config/env.js';
import {
  GroupModel,
  MembershipModel,
  UserModel,
  WishlistItemModel,
  claimNotification,
  setStat,
  type GroupDoc,
} from '../models/index.js';
import { deleteUserFolder } from '../services/cloudinary.js';
import { deleteGroupData } from '../services/group-data.js';
import { notifyUser } from '../services/notify.js';
import { logger } from '../utils/logger.js';

const DAY = 24 * 60 * 60 * 1000;
/** Undated groups are kept this long after creation. */
const UNDATED_GROUP_RETENTION_DAYS = 365;
/** Give people this long after the draw before nagging about an empty wishlist. */
const WISHLIST_GRACE_DAYS = 2;

export interface DailyJobReport {
  exchangeSoon: number;
  wishlistMissing: number;
  finished: number;
  deletedGroups: number;
  deletedUsers: number;
}

/**
 * Sends a notification to each participating member once, ever (keyed by `kind:group:user`).
 * Safe to call repeatedly: the notification log makes it idempotent.
 */
async function remindOnce(
  group: GroupDoc,
  kind: 'exchangeSoon' | 'wishlistMissing',
  userIds: unknown[],
): Promise<number> {
  let sent = 0;
  const users = await UserModel.find({ _id: { $in: userIds } });
  for (const user of users) {
    if (await claimNotification(`${kind}:${group.id}:${user.id}`, group._id)) {
      await notifyUser(user, kind, group);
      sent++;
    }
  }
  return sent;
}

async function participantIds(group: GroupDoc) {
  return (await MembershipModel.find({ groupId: group._id, participates: true }, { userId: 1 })).map(
    (m) => m.userId,
  );
}

/** "Exchange in 3 days": any drawn group whose exchange is within the next 3 days. */
async function exchangeSoonReminders(now: Date): Promise<number> {
  const groups = await GroupModel.find({
    status: 'drawn',
    exchangeDate: { $gt: now, $lte: new Date(now.getTime() + 3 * DAY) },
  });
  let sent = 0;
  for (const group of groups) sent += await remindOnce(group, 'exchangeSoon', await participantIds(group));
  return sent;
}

/** "Your wishlist is empty": participants without items, a couple of days after the draw. */
async function wishlistMissingReminders(now: Date): Promise<number> {
  const groups = await GroupModel.find({
    status: 'drawn',
    drawnAt: { $lte: new Date(now.getTime() - WISHLIST_GRACE_DAYS * DAY) },
    $or: [{ exchangeDate: null }, { exchangeDate: { $gt: now } }],
  });
  let sent = 0;
  for (const group of groups) {
    const ids = await participantIds(group);
    const withItems = new Set(
      (await WishlistItemModel.distinct('userId', { groupId: group._id })).map((id) => String(id)),
    );
    sent += await remindOnce(
      group,
      'wishlistMissing',
      ids.filter((id) => !withItems.has(String(id))),
    );
  }
  return sent;
}

/** Marks groups as finished the day after the exchange. */
async function finishGroups(now: Date): Promise<number> {
  const res = await GroupModel.updateMany(
    { status: 'drawn', exchangeDate: { $lte: new Date(now.getTime() - DAY) } },
    { $set: { status: 'finished' } },
  );
  return res.modifiedCount;
}

/** Deletes groups (and their Cloudinary images) DATA_RETENTION_DAYS after the exchange. */
async function retentionCleanup(now: Date): Promise<{ groups: number; users: number }> {
  const cutoff = new Date(now.getTime() - env.DATA_RETENTION_DAYS * DAY);
  const undatedCutoff = new Date(now.getTime() - UNDATED_GROUP_RETENTION_DAYS * DAY);
  const expired = await GroupModel.find(
    {
      $or: [{ exchangeDate: { $lte: cutoff } }, { exchangeDate: null, createdAt: { $lte: undatedCutoff } }],
    },
    { _id: 1 },
  );
  for (const g of expired) await deleteGroupData(String(g._id));

  // Users who no longer belong to any group and haven't for a while.
  const memberIds = await MembershipModel.distinct('userId');
  const orphanFilter = { _id: { $nin: memberIds }, createdAt: { $lte: cutoff } };
  const withAvatar = await UserModel.find({ ...orphanFilter, avatar: { $ne: null } }, { _id: 1 });
  for (const u of withAvatar) await deleteUserFolder(String(u._id));
  const orphans = await UserModel.deleteMany(orphanFilter);
  return { groups: expired.length, users: orphans.deletedCount };
}

let running = false;

/**
 * The daily job. Idempotent: each reminder is sent at most once and cleanup only removes data
 * past its retention date, so it's safe to run on every cold start to catch up on missed runs.
 */
export async function runDailyJob(now = new Date()): Promise<DailyJobReport | null> {
  if (running) return null;
  running = true;
  try {
    const exchangeSoon = await exchangeSoonReminders(now);
    const wishlistMissing = await wishlistMissingReminders(now);
    const finished = await finishGroups(now);
    const { groups, users } = await retentionCleanup(now);
    const report = { exchangeSoon, wishlistMissing, finished, deletedGroups: groups, deletedUsers: users };
    logger.info(report, 'Daily job finished');
    await setStat('job:daily', { ranAt: new Date().toISOString(), ok: true, report });
    return report;
  } catch (err) {
    logger.error({ err }, 'Daily job failed');
    await setStat('job:daily', { ranAt: new Date().toISOString(), ok: false, error: (err as Error).message });
    return null;
  } finally {
    running = false;
  }
}

/** Runs the job shortly after start-up (catch-up after sleeping) and then on the cron schedule. */
export function scheduleDailyJob(): () => void {
  const startup = setTimeout(() => void runDailyJob(), 10_000);
  const task = cron.schedule(env.DAILY_JOB_CRON, () => void runDailyJob(), { timezone: 'UTC' });
  return () => {
    clearTimeout(startup);
    void task.stop();
  };
}

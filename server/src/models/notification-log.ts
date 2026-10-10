import { Schema, model } from 'mongoose';

/**
 * Records notifications that have been sent, keyed by a deterministic string such as
 * `exchange-soon:<groupId>:<userId>`. The unique key makes scheduled jobs idempotent.
 */
const notificationLogSchema = new Schema({
  key: { type: String, required: true, unique: true },
  groupId: { type: Schema.Types.ObjectId, ref: 'Group', index: true },
  createdAt: { type: Date, default: Date.now },
});

export const NotificationLogModel = model('NotificationLog', notificationLogSchema);

/** Atomically claims a notification key. Returns true only for the first caller. */
export async function claimNotification(key: string, groupId?: unknown): Promise<boolean> {
  const res = await NotificationLogModel.updateOne(
    { key },
    { $setOnInsert: { key, groupId, createdAt: new Date() } },
    { upsert: true },
  );
  return res.upsertedCount === 1;
}

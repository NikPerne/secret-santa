import { Schema, model } from 'mongoose';

/**
 * Small key/value store for operational numbers shown on the admin health page, e.g.
 * `mail:2026-12-01` → emails sent that day, `job:daily` → last daily job report.
 */
const systemStatSchema = new Schema(
  {
    _id: { type: String, required: true },
    value: { type: Schema.Types.Mixed, default: 0 },
    /** Daily counters expire automatically after ~40 days. */
    expiresAt: { type: Date, default: null, index: { expires: 0 } },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export const SystemStatModel = model('SystemStat', systemStatSchema);

export const today = (d = new Date()) => d.toISOString().slice(0, 10);

/** Increments a per-day counter like `mail` → `mail:2026-12-01`. Never throws. */
export async function bumpDaily(name: string, by = 1): Promise<void> {
  try {
    await SystemStatModel.updateOne(
      { _id: `${name}:${today()}` },
      { $inc: { value: by }, $setOnInsert: { expiresAt: new Date(Date.now() + 40 * 24 * 3600 * 1000) } },
      { upsert: true },
    );
  } catch {
    /* stats must never break real work */
  }
}

export async function setStat(key: string, value: unknown): Promise<void> {
  try {
    await SystemStatModel.updateOne({ _id: key }, { $set: { value } }, { upsert: true });
  } catch {
    /* ignore */
  }
}

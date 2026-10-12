import { Schema, model } from 'mongoose';

/**
 * Single-use link that lets a user set their password: `setup` for a new account an admin created,
 * `reset` when the admin sends a reset link. Only the sha256 hash is stored; Mongo's TTL index
 * removes expired ones.
 */
const passwordTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  purpose: { type: String, enum: ['setup', 'reset'], required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
});

export const PasswordTokenModel = model('PasswordToken', passwordTokenSchema);

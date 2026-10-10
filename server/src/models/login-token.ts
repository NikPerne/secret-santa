import { Schema, model } from 'mongoose';

/** Single-use magic-link token. Only the sha256 hash is stored; Mongo's TTL index removes expired ones. */
const loginTokenSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  name: { type: String, trim: true },
  language: { type: String, enum: ['en', 'sl'] },
  inviteCode: { type: String },
  redirect: { type: String },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  usedAt: { type: Date, default: null },
});

export const LoginTokenModel = model('LoginToken', loginTokenSchema);

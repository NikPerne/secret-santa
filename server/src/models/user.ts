import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { imageSchema } from './image.js';

const pushSubscriptionSchema = new Schema(
  {
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    language: { type: String, enum: ['en', 'sl'], default: 'sl' },
    emailNotifications: { type: Boolean, default: true },
    /** Signed up with only an email: the app asks for a name once. */
    needsName: { type: Boolean, default: false },
    /** Profile picture on Cloudinary (folder users/<id>/avatar). */
    avatar: { type: imageSchema, default: null },
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
    /** scrypt hash (services/password.ts). Null until the user opens their setup link. */
    passwordHash: { type: String, default: null, select: false },
    /** Bumped when the password changes, which signs out every other session. */
    sessionVersion: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

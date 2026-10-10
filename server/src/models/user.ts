import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

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
    pushSubscriptions: { type: [pushSubscriptionSchema], default: [] },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type User = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<User>;
export const UserModel = model('User', userSchema);

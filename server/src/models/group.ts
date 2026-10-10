import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { imageSchema } from './image.js';

/** Gift themes a group can pick (e.g. "everything made in Slovenia"). */
export const THEME_PRESETS = [
  'none',
  'slovenian',
  'handmade',
  'experience',
  'books',
  'eco',
  'sweets',
  'custom',
] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

const exclusionSchema = new Schema(
  {
    a: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    b: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false },
);

const groupSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    coverImage: { type: imageSchema, default: null },
    exchangeDate: { type: Date, default: null },
    budget: {
      amount: { type: Number, min: 0, default: null },
      currency: { type: String, default: 'EUR', maxlength: 3 },
    },
    location: { type: String, trim: true, maxlength: 200, default: '' },
    organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    inviteCode: { type: String, required: true, unique: true },
    status: { type: String, enum: ['open', 'drawn', 'finished'], default: 'open' },
    settings: {
      organizerSeesPairs: { type: Boolean, default: false },
      organizerParticipates: { type: Boolean, default: true },
      allowShippingAddress: { type: Boolean, default: false },
      bigRevealAfterExchange: { type: Boolean, default: true },
      avoidPreviousPairs: { type: Boolean, default: true },
    },
    theme: {
      preset: { type: String, enum: THEME_PRESETS, default: 'none' },
      /** Extra rules or the custom theme, e.g. "Only second-hand gifts". */
      text: { type: String, trim: true, maxlength: 200, default: '' },
    },
    exclusions: { type: [exclusionSchema], default: [] },
    previousGroupId: { type: Schema.Types.ObjectId, ref: 'Group', default: null },
    drawnAt: { type: Date, default: null },
  },
  { timestamps: true },
);

groupSchema.index({ exchangeDate: 1 });

export type Group = InferSchemaType<typeof groupSchema>;
export type GroupDoc = HydratedDocument<Group>;
export const GroupModel = model('Group', groupSchema);

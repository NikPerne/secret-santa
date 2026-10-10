import { Schema, model, type InferSchemaType } from 'mongoose';

const preferencesSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sizes: { type: String, trim: true, maxlength: 500, default: '' },
    likes: { type: String, trim: true, maxlength: 1000, default: '' },
    dislikes: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true },
);

preferencesSchema.index({ groupId: 1, userId: 1 }, { unique: true });

export type Preferences = InferSchemaType<typeof preferencesSchema>;
export const PreferencesModel = model('Preferences', preferencesSchema);

import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './image.js';

const galleryPhotoSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    image: { type: imageSchema, required: true },
    caption: { type: String, trim: true, maxlength: 280, default: '' },
  },
  { timestamps: true },
);

export type GalleryPhoto = InferSchemaType<typeof galleryPhotoSchema>;
export const GalleryPhotoModel = model('GalleryPhoto', galleryPhotoSchema);

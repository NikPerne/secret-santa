import { Schema, model, type InferSchemaType } from 'mongoose';
import { imageSchema } from './image.js';

const wishlistItemSchema = new Schema(
  {
    groupId: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, trim: true, maxlength: 1000, default: '' },
    price: { type: Number, min: 0, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    image: { type: imageSchema, default: null },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

wishlistItemSchema.index({ groupId: 1, userId: 1, order: 1 });

export type WishlistItem = InferSchemaType<typeof wishlistItemSchema>;
export const WishlistItemModel = model('WishlistItem', wishlistItemSchema);

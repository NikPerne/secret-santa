import { Schema } from 'mongoose';

/** A Cloudinary image reference. Binaries never go into MongoDB. */
export const imageSchema = new Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    width: { type: Number },
    height: { type: Number },
  },
  { _id: false },
);

export interface ImageRef {
  url: string;
  publicId: string;
  width?: number | null;
  height?: number | null;
}

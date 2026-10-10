import type { Types } from 'mongoose';
import {
  AssignmentModel,
  GalleryPhotoModel,
  GroupModel,
  MembershipModel,
  MessageModel,
  NotificationLogModel,
  PreferencesModel,
  WishlistItemModel,
} from '../models/index.js';
import { deleteGroupFolder, deleteImages } from './cloudinary.js';

/** Permanently deletes a group with everything that belongs to it, including Cloudinary images. */
export async function deleteGroupData(groupId: Types.ObjectId | string): Promise<void> {
  const group = await GroupModel.findById(groupId);
  const [items, photos] = await Promise.all([
    WishlistItemModel.find({ groupId, image: { $ne: null } }, { image: 1 }),
    GalleryPhotoModel.find({ groupId }, { image: 1 }),
  ]);
  await deleteImages([
    group?.coverImage?.publicId,
    ...items.map((i) => i.image?.publicId),
    ...photos.map((p) => p.image?.publicId),
  ]);
  await deleteGroupFolder(String(groupId));
  await Promise.all([
    AssignmentModel.deleteMany({ groupId }),
    GalleryPhotoModel.deleteMany({ groupId }),
    MembershipModel.deleteMany({ groupId }),
    MessageModel.deleteMany({ groupId }),
    NotificationLogModel.deleteMany({ groupId }),
    PreferencesModel.deleteMany({ groupId }),
    WishlistItemModel.deleteMany({ groupId }),
  ]);
  await GroupModel.deleteOne({ _id: groupId });
}

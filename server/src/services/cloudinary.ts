import { v2 as cloudinary } from 'cloudinary';
import { cloudinaryEnabled, env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export type UploadPurpose = 'wishlist' | 'gallery' | 'cover' | 'avatar';

/** Folder scope for a user's own images (profile picture), next to the per-group folders. */
export const userScope = (userId: string) => `users/${userId}`;

if (cloudinaryEnabled) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export const folderFor = (groupId: string, purpose: UploadPurpose) =>
  `${env.CLOUDINARY_FOLDER}/${groupId}/${purpose}`;

/** Parameters the browser needs for a signed direct upload to Cloudinary. */
export function createUploadSignature(groupId: string, purpose: UploadPurpose) {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: folderFor(groupId, purpose),
    allowed_formats: 'jpg,jpeg,png,webp,gif,heic,avif',
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    ...params,
    signature,
  };
}

/**
 * Checks that an image reference submitted by a client points at our Cloudinary account and the
 * group's folder, so users can't attach arbitrary URLs or other groups' images.
 */
export function isOwnedImage(image: { url: string; publicId: string }, groupId: string): boolean {
  if (!cloudinaryEnabled) return false;
  const prefix = `${env.CLOUDINARY_FOLDER}/${groupId}/`;
  return (
    image.publicId.startsWith(prefix) &&
    image.url.startsWith(`https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/`) &&
    image.url.includes(image.publicId)
  );
}

/** Deletes images from Cloudinary. Best-effort: failures are logged, never thrown. */
export async function deleteImages(publicIds: Array<string | null | undefined>): Promise<void> {
  const ids = [...new Set(publicIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return;
  if (!cloudinaryEnabled) {
    logger.info({ ids }, 'Cloudinary not configured: skipping image deletion');
    return;
  }
  // The Admin API accepts up to 100 public ids per call.
  for (let i = 0; i < ids.length; i += 100) {
    try {
      await cloudinary.api.delete_resources(ids.slice(i, i + 100), { resource_type: 'image' });
    } catch (err) {
      logger.error({ err }, 'Failed to delete Cloudinary images');
    }
  }
}

/** Deletes all of a user's own images (profile picture). */
export async function deleteUserFolder(userId: string): Promise<void> {
  if (!cloudinaryEnabled) return;
  try {
    await cloudinary.api.delete_resources_by_prefix(`${env.CLOUDINARY_FOLDER}/${userScope(userId)}/`);
  } catch (err) {
    logger.error({ err, userId }, 'Failed to delete Cloudinary user folder');
  }
}

/** Deletes a whole group folder (used when a group is deleted). */
export async function deleteGroupFolder(groupId: string): Promise<void> {
  if (!cloudinaryEnabled) return;
  try {
    await cloudinary.api.delete_resources_by_prefix(`${env.CLOUDINARY_FOLDER}/${groupId}/`);
  } catch (err) {
    logger.error({ err, groupId }, 'Failed to delete Cloudinary group folder');
  }
}

/**
 * Lets Cloudinary download a remote image (e.g. a shop's product photo) straight into the
 * group's wishlist folder, resized like browser uploads. The image never passes through our
 * server, so it costs no Render bandwidth. Returns null on failure.
 */
export async function importRemoteImage(imageUrl: string, groupId: string) {
  if (!cloudinaryEnabled) return null;
  try {
    const res = await cloudinary.uploader.upload(imageUrl, {
      folder: folderFor(groupId, 'wishlist'),
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'],
      transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
      timeout: 20_000,
    });
    return { url: res.secure_url, publicId: res.public_id, width: res.width, height: res.height };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Could not import preview image');
    return null;
  }
}

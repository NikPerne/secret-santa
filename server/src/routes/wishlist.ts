import { Router } from 'express';
import type { Types } from 'mongoose';
import { z } from 'zod';
import { groupCtx } from '../middleware/group.js';
import { imageInput, objectId, optionalUrl, parse, trimmed } from '../middleware/validate.js';
import { AssignmentModel, PreferencesModel, WishlistItemModel, type GroupDoc } from '../models/index.js';
import { uploadLimiter } from '../middleware/rate-limit.js';
import { deleteImages, importRemoteImage, isOwnedImage } from '../services/cloudinary.js';
import { LinkPreviewError, getLinkMeta } from '../services/link-preview.js';
import { serializeImage } from '../services/serializers.js';
import { badRequest, conflict, notFound } from '../utils/http-error.js';

export const wishlistRouter = Router({ mergeParams: true });

const MAX_ITEMS = 50;

const itemInput = z.object({
  title: trimmed(120).min(1),
  url: optionalUrl,
  price: z.number().min(0).max(1_000_000).nullable().optional(),
  notes: trimmed(1000).optional(),
  image: imageInput.nullable().optional(),
});

const preferencesInput = z.object({
  sizes: trimmed(500).optional(),
  likes: trimmed(1000).optional(),
  dislikes: trimmed(1000).optional(),
});

interface ItemDoc {
  id: string;
  title: string;
  url: string;
  price?: number | null;
  notes: string;
  image?: { url: string; publicId: string; width?: number | null; height?: number | null } | null;
  order: number;
}

const serializeItem = (item: ItemDoc) => ({
  id: item.id,
  title: item.title,
  url: item.url,
  price: item.price ?? null,
  notes: item.notes,
  image: serializeImage(item.image),
  order: item.order,
});

const serializePreferences = (p: { sizes?: string; likes?: string; dislikes?: string } | null) => ({
  sizes: p?.sizes ?? '',
  likes: p?.likes ?? '',
  dislikes: p?.dislikes ?? '',
});

function checkImage(image: { url: string; publicId: string } | null | undefined, group: GroupDoc) {
  if (image && !isOwnedImage(image, group.id)) {
    throw badRequest('invalid_image', 'Images must be uploaded through the app');
  }
}

const listItems = (groupId: Types.ObjectId, userId: Types.ObjectId) =>
  WishlistItemModel.find({ groupId, userId }).sort({ order: 1, createdAt: 1 });

// ---------- My wishlist ----------
wishlistRouter.get('/wishlist', async (req, res) => {
  const { group, user } = groupCtx(req);
  res.json({ items: (await listItems(group._id, user._id)).map(serializeItem) });
});

wishlistRouter.post('/wishlist', async (req, res) => {
  const { group, user } = groupCtx(req);
  const body = parse(itemInput, req.body);
  checkImage(body.image, group);
  const count = await WishlistItemModel.countDocuments({ groupId: group._id, userId: user._id });
  if (count >= MAX_ITEMS) throw conflict('too_many_items', `A wishlist can have up to ${MAX_ITEMS} items`);
  const last = await WishlistItemModel.findOne({ groupId: group._id, userId: user._id }).sort({ order: -1 });
  const item = await WishlistItemModel.create({
    ...body,
    groupId: group._id,
    userId: user._id,
    order: (last?.order ?? -1) + 1,
  });
  res.status(201).json({ item: serializeItem(item) });
});

wishlistRouter.put('/wishlist/order', async (req, res) => {
  const { group, user } = groupCtx(req);
  const { ids } = parse(z.object({ ids: z.array(objectId).max(MAX_ITEMS) }), req.body);
  await WishlistItemModel.bulkWrite(
    ids.map((id, order) => ({
      updateOne: { filter: { _id: id, groupId: group._id, userId: user._id }, update: { $set: { order } } },
    })),
  );
  res.json({ items: (await listItems(group._id, user._id)).map(serializeItem) });
});

wishlistRouter.patch('/wishlist/:itemId', async (req, res) => {
  const { group, user } = groupCtx(req);
  const { itemId } = parse(z.object({ itemId: objectId }), req.params);
  const body = parse(itemInput.partial(), req.body);
  checkImage(body.image, group);
  const item = await WishlistItemModel.findOne({ _id: itemId, groupId: group._id, userId: user._id });
  if (!item) throw notFound('Item not found');
  if (body.image !== undefined && item.image?.publicId && item.image.publicId !== body.image?.publicId) {
    await deleteImages([item.image.publicId]);
  }
  item.set(body);
  await item.save();
  res.json({ item: serializeItem(item) });
});

wishlistRouter.delete('/wishlist/:itemId', async (req, res) => {
  const { group, user } = groupCtx(req);
  const { itemId } = parse(z.object({ itemId: objectId }), req.params);
  const item = await WishlistItemModel.findOneAndDelete({
    _id: itemId,
    groupId: group._id,
    userId: user._id,
  });
  if (!item) throw notFound('Item not found');
  await deleteImages([item.image?.publicId]);
  res.json({ ok: true });
});

// ---------- My preferences ----------
wishlistRouter.get('/preferences', async (req, res) => {
  const { group, user } = groupCtx(req);
  const prefs = await PreferencesModel.findOne({ groupId: group._id, userId: user._id });
  res.json({ preferences: serializePreferences(prefs) });
});

wishlistRouter.put('/preferences', async (req, res) => {
  const { group, user } = groupCtx(req);
  const body = parse(preferencesInput, req.body);
  const prefs = await PreferencesModel.findOneAndUpdate(
    { groupId: group._id, userId: user._id },
    { $set: body },
    { upsert: true, returnDocument: 'after' },
  );
  res.json({ preferences: serializePreferences(prefs) });
});

// ---------- My match's wishlist (read-only) ----------
/** Only the receiver of the caller's own assignment. */
async function myReceiverId(req: Parameters<typeof groupCtx>[0]) {
  const { group, membership } = groupCtx(req);
  if (group.status === 'open') throw conflict('not_drawn', 'Names have not been drawn yet');
  const assignment = await AssignmentModel.findOne({ groupId: group._id, giverId: membership.userId });
  if (!assignment) throw notFound('No match yet');
  return assignment.receiverId;
}

wishlistRouter.get('/match/wishlist', async (req, res) => {
  const { group } = groupCtx(req);
  const receiverId = await myReceiverId(req);
  const [items, prefs] = await Promise.all([
    listItems(group._id, receiverId),
    PreferencesModel.findOne({ groupId: group._id, userId: receiverId }),
  ]);
  res.json({ items: items.map(serializeItem), preferences: serializePreferences(prefs) });
});

/**
 * Link preview for the "add a wish" form: paste a shop link, get title, price and photo.
 * The photo is imported into Cloudinary (the group's folder) so it behaves like an upload.
 */
wishlistRouter.post('/link-preview', uploadLimiter, async (req, res) => {
  const { group } = groupCtx(req);
  const { url } = parse(z.object({ url: z.string().trim().url().max(1000) }), req.body);
  let meta;
  try {
    meta = await getLinkMeta(url);
  } catch (err) {
    if (err instanceof LinkPreviewError) throw badRequest('preview_failed', err.message);
    throw badRequest('preview_failed', 'Could not read that page');
  }
  const image = meta.imageUrl ? await importRemoteImage(meta.imageUrl, group.id) : null;
  res.json({
    preview: {
      title: meta.title,
      siteName: meta.siteName,
      price: meta.price,
      currency: meta.currency,
      image: serializeImage(image),
    },
  });
});

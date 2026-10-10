import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { groupCtx } from '../middleware/group.js';
import { imageInput, objectId, parse, trimmed } from '../middleware/validate.js';
import { GalleryPhotoModel, UserModel } from '../models/index.js';
import { deleteImages, isOwnedImage } from '../services/cloudinary.js';
import { buildIcs } from '../services/ics.js';
import { exchangePassed, serializeImage } from '../services/serializers.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error.js';

/** Calendar export and the after-party gallery. */
export const extrasRouter = Router({ mergeParams: true });

extrasRouter.get('/calendar.ics', (req, res) => {
  const { group } = groupCtx(req);
  if (!group.exchangeDate) throw notFound('This group has no exchange date yet');
  const budget =
    group.budget?.amount != null ? `Budget: ${group.budget.amount} ${group.budget.currency}` : '';
  const ics = buildIcs({
    uid: `${group.id}@secret-santa`,
    title: `🎁 ${group.name}`,
    date: group.exchangeDate,
    description: [group.description, budget, `${env.CLIENT_URL}/g/${group.id}`].filter(Boolean).join('\n\n'),
    location: group.location || undefined,
    url: `${env.CLIENT_URL}/g/${group.id}`,
  });
  const filename =
    group.name
      .replace(/[^\w\- ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'secret-santa';
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}.ics"`);
  res.send(ics);
});

// ---------- Gallery (opens after the exchange date) ----------
function requireGalleryOpen(group: Parameters<typeof exchangePassed>[0]) {
  if (!exchangePassed(group)) throw conflict('gallery_closed', 'The gallery opens after the gift exchange');
}

extrasRouter.get('/gallery', async (req, res) => {
  const { group, user } = groupCtx(req);
  if (!exchangePassed(group)) {
    res.json({ open: false, photos: [] });
    return;
  }
  const photos = await GalleryPhotoModel.find({ groupId: group._id }).sort({ createdAt: -1 }).limit(300);
  const users = await UserModel.find({ _id: { $in: photos.map((p) => p.userId) } }, { name: 1 });
  const names = new Map(users.map((u) => [u.id as string, u.name]));
  res.json({
    open: true,
    photos: photos.map((p) => ({
      id: p.id as string,
      image: serializeImage(p.image),
      caption: p.caption,
      by: names.get(String(p.userId)) ?? '?',
      mine: String(p.userId) === user.id,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

extrasRouter.post('/gallery', async (req, res) => {
  const { group, user } = groupCtx(req);
  requireGalleryOpen(group);
  const body = parse(z.object({ image: imageInput, caption: trimmed(280).optional() }), req.body);
  if (!isOwnedImage(body.image, group.id))
    throw badRequest('invalid_image', 'Images must be uploaded through the app');
  const photo = await GalleryPhotoModel.create({ groupId: group._id, userId: user._id, ...body });
  res.status(201).json({
    photo: {
      id: photo.id as string,
      image: serializeImage(photo.image),
      caption: photo.caption,
      by: user.name,
      mine: true,
      createdAt: photo.createdAt.toISOString(),
    },
  });
});

extrasRouter.delete('/gallery/:photoId', async (req, res) => {
  const { group, user, isOrganizer } = groupCtx(req);
  const { photoId } = parse(z.object({ photoId: objectId }), req.params);
  const photo = await GalleryPhotoModel.findOne({ _id: photoId, groupId: group._id });
  if (!photo) throw notFound('Photo not found');
  if (String(photo.userId) !== user.id && !isOrganizer)
    throw forbidden('You can only delete your own photos');
  await deleteImages([photo.image?.publicId]);
  await photo.deleteOne();
  res.json({ ok: true });
});

import { Router } from 'express';
import { z } from 'zod';
import { cloudinaryEnabled } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rate-limit.js';
import { objectId, parse } from '../middleware/validate.js';
import { GroupModel, MembershipModel } from '../models/index.js';
import { createUploadSignature, userScope } from '../services/cloudinary.js';
import { exchangePassed } from '../services/serializers.js';
import { HttpError, forbidden, notFound } from '../utils/http-error.js';

export const uploadsRouter = Router();

/**
 * Issues a signature for a direct browser → Cloudinary upload into the group's folder.
 * The API secret never leaves the server; the image never passes through it.
 */
uploadsRouter.post('/signature', uploadLimiter, async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.discriminatedUnion('purpose', [
      z.object({ purpose: z.literal('avatar') }),
      z.object({ purpose: z.enum(['wishlist', 'gallery', 'cover']), groupId: objectId }),
    ]),
    req.body,
  );
  if (!cloudinaryEnabled) throw new HttpError(503, 'uploads_disabled', 'Image uploads are not configured');
  // Profile pictures go to the user's own folder.
  if (body.purpose === 'avatar') {
    res.json(createUploadSignature(userScope(user.id), 'avatar'));
    return;
  }
  const { groupId, purpose } = body;

  const [group, membership] = await Promise.all([
    GroupModel.findById(groupId),
    MembershipModel.findOne({ groupId, userId: user._id }),
  ]);
  if (!group || !membership) throw notFound('Group not found');
  if (purpose === 'cover' && membership.role !== 'organizer')
    throw forbidden('Only the organizer can change the cover');
  if (purpose === 'gallery' && !exchangePassed(group))
    throw forbidden('The gallery opens after the exchange');

  res.json(createUploadSignature(groupId, purpose));
});

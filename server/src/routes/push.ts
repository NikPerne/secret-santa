import { Router } from 'express';
import { z } from 'zod';
import { pushEnabled } from '../config/env.js';
import { currentUser } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { UserModel } from '../models/index.js';
import { HttpError } from '../utils/http-error.js';

export const pushRouter = Router();

const MAX_DEVICES = 10;

const subscriptionInput = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

pushRouter.post('/subscribe', async (req, res) => {
  if (!pushEnabled) throw new HttpError(503, 'push_disabled', 'Push notifications are not configured');
  const user = currentUser(req);
  const sub = parse(subscriptionInput, req.body);
  // Replace any existing entry for this device, keep the newest MAX_DEVICES.
  await UserModel.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint: sub.endpoint } } });
  await UserModel.updateOne(
    { _id: user._id },
    { $push: { pushSubscriptions: { $each: [{ ...sub, createdAt: new Date() }], $slice: -MAX_DEVICES } } },
  );
  res.json({ ok: true });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const user = currentUser(req);
  const { endpoint } = parse(z.object({ endpoint: z.string().url().max(1000) }), req.body);
  await UserModel.updateOne({ _id: user._id }, { $pull: { pushSubscriptions: { endpoint } } });
  res.json({ ok: true });
});

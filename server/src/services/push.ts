import webpush from 'web-push';
import { env, pushEnabled } from '../config/env.js';
import { UserModel, type UserDoc } from '../models/index.js';
import { logger } from '../utils/logger.js';

if (pushEnabled) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

export interface PushMessage {
  title: string;
  body: string;
  /** App path to open when the notification is tapped, e.g. /g/123/reveal */
  url: string;
}

/**
 * Sends a Web Push notification to all of a user's devices, in the payload format Angular's
 * service worker understands. Expired subscriptions are removed. Never throws.
 */
export async function sendPush(user: UserDoc, message: PushMessage): Promise<number> {
  if (!pushEnabled || !user.pushSubscriptions.length) return 0;
  const payload = JSON.stringify({
    notification: {
      title: message.title,
      body: message.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      data: { onActionClick: { default: { operation: 'navigateLastFocusedOrOpen', url: message.url } } },
    },
  });
  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.keys!.p256dh, auth: sub.keys!.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.endpoint);
        else logger.warn({ err: (err as Error).message, status }, 'Push failed');
      }
    }),
  );
  if (expired.length) {
    await UserModel.updateOne(
      { _id: user._id },
      { $pull: { pushSubscriptions: { endpoint: { $in: expired } } } },
    );
  }
  return sent;
}

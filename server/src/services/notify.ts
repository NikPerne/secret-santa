import { env } from '../config/env.js';
import { UserModel, type GroupDoc, type UserDoc } from '../models/index.js';
import { logger } from '../utils/logger.js';
import { sendEmail } from './email.js';
import { formatDate, pushText, templates } from './email-templates.js';
import { sendPush } from './push.js';

export type NotificationKind =
  | 'drawDone'
  | 'matchChanged'
  | 'wishlistMissing'
  | 'exchangeSoon'
  | 'newMessage'
  | 'nudgeReveal'
  | 'thankYou';

const pathFor: Record<NotificationKind, (groupId: string) => string> = {
  drawDone: (g) => `/g/${g}/reveal`,
  matchChanged: (g) => `/g/${g}/reveal`,
  wishlistMissing: (g) => `/g/${g}/wishlist`,
  exchangeSoon: (g) => `/g/${g}`,
  newMessage: (g) => `/g/${g}`,
  nudgeReveal: (g) => `/g/${g}/reveal`,
  thankYou: (g) => `/g/${g}`,
};

function emailFor(kind: NotificationKind, user: UserDoc, group: GroupDoc, url: string) {
  const t = templates(user.language);
  switch (kind) {
    case 'drawDone':
      return t.drawDone(user.name, group.name, url);
    case 'matchChanged':
      return t.matchChanged(user.name, group.name, url);
    case 'wishlistMissing':
      return t.wishlistMissing(user.name, group.name, url);
    case 'exchangeSoon':
      return t.exchangeSoon(
        user.name,
        group.name,
        formatDate(group.exchangeDate ?? new Date(), user.language),
        url,
      );
    case 'nudgeReveal':
      return t.nudgeReveal(user.name, group.name, url);
    case 'thankYou':
      return t.thankYou(user.name, group.name, url);
    case 'newMessage':
      return null; // push only: emailing every chat message would be spammy
  }
}

/** Sends a notification by email (if the user allows it) and web push. Never throws. */
export async function notifyUser(user: UserDoc, kind: NotificationKind, group: GroupDoc): Promise<void> {
  try {
    const path = pathFor[kind](group.id);
    const email = emailFor(kind, user, group, `${env.CLIENT_URL}${path}`);
    const push = pushText(user.language)[kind](group.name);
    await Promise.all([
      email && user.emailNotifications ? sendEmail(user.email, email) : null,
      sendPush(user, { ...push, url: path }),
    ]);
  } catch (err) {
    logger.error({ err, kind }, 'Notification failed');
  }
}

export async function notifyUsers(
  userIds: unknown[],
  kind: NotificationKind,
  group: GroupDoc,
): Promise<void> {
  if (!userIds.length) return;
  try {
    const users = await UserModel.find({ _id: { $in: userIds } });
    await Promise.all(users.map((u) => notifyUser(u, kind, group)));
  } catch (err) {
    logger.error({ err, kind }, 'Notifications failed');
  }
}

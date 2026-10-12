import { emailEnabled, env, isProd } from '../config/env.js';
import { PasswordTokenModel, type UserDoc } from '../models/index.js';
import { sendEmail } from './email.js';
import { templates } from './email-templates.js';
import { RESET_LINK_TTL_MS, SETUP_LINK_TTL_MS, hashToken, randomToken } from './tokens.js';

export type PasswordLinkPurpose = 'setup' | 'reset';

/**
 * Emails the user a single-use link to set their password. Older unused links for the same user
 * stop working, so only the newest email counts. `devLink` is returned only in development
 * without an email provider (like the old magic links).
 */
export async function sendPasswordLink(user: UserDoc, purpose: PasswordLinkPurpose) {
  const token = randomToken();
  await PasswordTokenModel.deleteMany({ userId: user._id });
  await PasswordTokenModel.create({
    tokenHash: hashToken(token),
    userId: user._id,
    purpose,
    expiresAt: new Date(Date.now() + (purpose === 'setup' ? SETUP_LINK_TTL_MS : RESET_LINK_TTL_MS)),
  });

  const link = `${env.CLIENT_URL}/auth/set-password?token=${encodeURIComponent(token)}`;
  const t = templates(user.language);
  const sent = await sendEmail(
    user.email,
    purpose === 'setup' ? t.accountSetup(user.name, user.email, link) : t.passwordReset(user.name, link),
  );
  return { sent, devLink: !isProd && !emailEnabled ? link : undefined };
}

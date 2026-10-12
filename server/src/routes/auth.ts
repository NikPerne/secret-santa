import { Router, type Response } from 'express';
import { z } from 'zod';
import { adminEmails, instantJoinEnabled } from '../config/env.js';
import { currentUser, requireAuth } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rate-limit.js';
import { imageInput, parse, trimmed } from '../middleware/validate.js';
import { deleteImages, isOwnedImage, userScope } from '../services/cloudinary.js';
import { PasswordTokenModel, UserModel, type UserDoc } from '../models/index.js';
import { findGroupByInvite, joinGroup } from '../services/membership.js';
import { deleteAccount } from '../services/account.js';
import { PASSWORD_MAX, PASSWORD_MIN, hashPassword, verifyPassword } from '../services/password.js';
import { sendPasswordLink } from '../services/password-links.js';
import { serializeUser } from '../services/serializers.js';
import { SESSION_COOKIE, hashToken, sessionCookieOptions, signSession } from '../services/tokens.js';
import { HttpError, badRequest, forbidden } from '../utils/http-error.js';

export const authRouter = Router();

const unauthorizedCode = (code: string, message: string) => new HttpError(401, code, message);

const email = z.string().trim().toLowerCase().email().max(200);
const name = trimmed(60).min(1);
const language = z.enum(['en', 'sl']);
const inviteCode = z
  .string()
  .trim()
  .max(40)
  .regex(/^[A-Za-z0-9_-]+$/);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const passwordToken = z.string().min(10).max(200);

interface SignInInput {
  email: string;
  name?: string;
  language?: 'en' | 'sl';
  inviteCode?: string | null;
}

async function upsertUser(input: SignInInput): Promise<UserDoc> {
  const existing = await UserModel.findOne({ email: input.email });
  if (existing) {
    // First real name for someone who signed up with only an email (e.g. while joining a group).
    if (existing.needsName && input.name) {
      existing.name = input.name;
      existing.needsName = false;
      await existing.save();
    }
    return existing;
  }
  try {
    return await UserModel.create({
      email: input.email,
      // Without a name (plain sign-in), use the email prefix for now; the app asks once.
      name: input.name || input.email.split('@')[0],
      needsName: !input.name,
      language: input.language ?? 'sl',
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      const user = await UserModel.findOne({ email: input.email });
      if (user) return user;
    }
    throw err;
  }
}

/** Creates the session for a verified user, joining the invited group when there is one. */
async function completeSignIn(res: Response, input: SignInInput) {
  const user = await upsertUser(input);
  let groupId: string | undefined;
  if (input.inviteCode) {
    const group = await findGroupByInvite(input.inviteCode);
    await joinGroup(user, group);
    groupId = group.id;
  }
  res.cookie(SESSION_COOKIE, signSession(user.id, user.sessionVersion), sessionCookieOptions());
  return { user: serializeUser(user), groupId };
}

/** Email + password. Accounts are created by an admin (see routes/admin.ts). */
authRouter.post('/login', authLimiter, async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1).max(PASSWORD_MAX) }), req.body);
  const user = await UserModel.findOne({ email: body.email }).select('+passwordHash');
  // Always runs the hash check, so the answer can't tell whether the email has an account.
  const ok = await verifyPassword(body.password, user?.passwordHash);
  if (!user || !ok) throw unauthorizedCode('invalid_credentials', 'Wrong email or password');
  res.cookie(SESSION_COOKIE, signSession(user.id, user.sessionVersion), sessionCookieOptions());
  res.json({ user: serializeUser(user) });
});

async function findPasswordToken(token: string) {
  return PasswordTokenModel.findOne({
    tokenHash: hashToken(token),
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
}

/** Lets the set-password page greet the user before they pick a password. Doesn't use the link up. */
authRouter.post('/password-token', authLimiter, async (req, res) => {
  const { token } = parse(z.object({ token: passwordToken }), req.body);
  const record = await findPasswordToken(token);
  const user = record ? await UserModel.findById(record.userId) : null;
  if (!record || !user) throw badRequest('invalid_token', 'This link is invalid or has expired');
  res.json({ name: user.name, email: user.email, purpose: record.purpose });
});

/** Sets the password from an emailed setup/reset link and signs the user in. */
authRouter.post('/set-password', authLimiter, async (req, res) => {
  const body = parse(z.object({ token: passwordToken, password }), req.body);
  // Atomic single use: only one request can flip usedAt from null.
  const record = await PasswordTokenModel.findOneAndUpdate(
    { tokenHash: hashToken(body.token), usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: 'after' },
  );
  const user = record ? await UserModel.findById(record.userId) : null;
  if (!record || !user) throw badRequest('invalid_token', 'This link is invalid or has expired');

  user.passwordHash = await hashPassword(body.password);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  await PasswordTokenModel.deleteMany({ userId: user._id });
  res.cookie(SESSION_COOKIE, signSession(user.id, user.sessionVersion), sessionCookieOptions());
  res.json({ user: serializeUser(user) });
});

/**
 * First-time setup for the emails in ADMIN_EMAILS: creates the account if needed and emails a setup
 * link, but only while that admin has no password yet. Answers the same way for everyone.
 */
authRouter.post('/admin-setup', authLimiter, async (req, res) => {
  const body = parse(z.object({ email, language: language.optional() }), req.body);
  let devLink: string | undefined;
  if (adminEmails.has(body.email)) {
    const user =
      (await UserModel.findOne({ email: body.email }).select('+passwordHash')) ??
      (await UserModel.create({
        email: body.email,
        name: body.email.split('@')[0],
        needsName: true,
        language: body.language ?? 'sl',
      }));
    if (!user.passwordHash) devLink = (await sendPasswordLink(user, 'setup')).devLink;
  }
  res.json({ sent: true, devLink });
});

/** Development only: sign in / join instantly without an email round-trip. */
authRouter.post('/dev-login', async (req, res) => {
  if (!instantJoinEnabled) throw forbidden('Instant join is disabled');
  const body = parse(
    z.object({
      email,
      name: name.optional(),
      language: language.optional(),
      inviteCode: inviteCode.optional(),
    }),
    req.body,
  );
  res.json(await completeSignIn(res, body));
});

authRouter.get('/me', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ user: req.user ? serializeUser(req.user) : null });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.json({ ok: true });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      name: name.optional(),
      language: language.optional(),
      emailNotifications: z.boolean().optional(),
      avatar: imageInput.nullable().optional(),
    }),
    req.body,
  );
  const { avatar, ...rest } = body;
  if (avatar !== undefined) {
    if (avatar && !isOwnedImage(avatar, userScope(user.id))) {
      throw badRequest('invalid_image', 'Images must be uploaded through the app');
    }
    const old = user.avatar?.publicId;
    if (old && old !== avatar?.publicId) await deleteImages([old]);
    user.set('avatar', avatar);
  }
  Object.assign(user, rest);
  if (body.name) user.needsName = false;
  await user.save();
  res.json({ user: serializeUser(user) });
});

authRouter.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const body = parse(
    z.object({ currentPassword: z.string().min(1).max(PASSWORD_MAX), newPassword: password }),
    req.body,
  );
  const user = await UserModel.findById(currentUser(req)._id).select('+passwordHash');
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    throw badRequest('wrong_password', 'The current password is wrong');
  }
  user.passwordHash = await hashPassword(body.newPassword);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  await user.save();
  // Other devices are signed out; this one gets a fresh session.
  res.cookie(SESSION_COOKIE, signSession(user.id, user.sessionVersion), sessionCookieOptions());
  res.json({ ok: true });
});

/** "Delete my data" */
authRouter.delete('/me', requireAuth, async (req, res) => {
  await deleteAccount(currentUser(req));
  const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
  res.clearCookie(SESSION_COOKIE, opts);
  res.json({ ok: true });
});

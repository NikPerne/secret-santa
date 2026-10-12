import type { RequestHandler } from 'express';
import { UserModel, type UserDoc } from '../models/index.js';
import { SESSION_COOKIE, sessionCookieOptions, verifySession } from '../services/tokens.js';
import { unauthorized } from '../utils/http-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
  }
}

/** Loads the signed-in user (if any) from the session cookie. */
export const loadUser: RequestHandler = async (req, res, next) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next();
  const session = verifySession(token);
  const user = session ? await UserModel.findById(session.userId) : null;
  if (user && (user.sessionVersion ?? 0) === session?.version) {
    req.user = user;
  } else {
    // Stale cookie (user deleted, password changed or bad signature): drop it.
    const { maxAge: _maxAge, ...opts } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, opts);
  }
  next();
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

/** Typed accessor for routes behind `requireAuth`. */
export function currentUser(req: { user?: UserDoc }): UserDoc {
  if (!req.user) throw unauthorized();
  return req.user;
}

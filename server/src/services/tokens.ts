import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import type { CookieOptions } from 'express';

export const SESSION_COOKIE = 'ss_session';
const SESSION_DAYS = 60;
/** A new account's setup link and an admin-sent reset link. */
export const SETUP_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const RESET_LINK_TTL_MS = 24 * 60 * 60 * 1000;

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Short, unambiguous, URL-safe invite code (no 0/O/1/l/I). */
export function generateInviteCode(length = 8): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/** `v` is the user's `sessionVersion`: changing the password bumps it and ends older sessions. */
export function signSession(userId: string, version = 0): string {
  return jwt.sign({ sub: userId, v: version }, env.JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifySession(token: string): { userId: string; version: number } | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload !== 'object' || typeof payload.sub !== 'string') return null;
    return { userId: payload.sub, version: typeof payload.v === 'number' ? payload.v : 0 };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProd || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}

import type { Request } from 'express';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

const skip = () => env.NODE_ENV === 'test';
const byUserOrIp = (req: Request) => req.user?.id ?? ipKeyGenerator(req.ip ?? '');
const message = { error: { code: 'rate_limited', message: 'Too many requests, please slow down.' } };

/** Magic-link requests and verification: strict per IP. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip,
  message,
});

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  skip,
  message,
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  skip: (req) => skip() || req.method === 'GET',
  message,
});

/** Invite emails: generous for a family, useless for spamming. */
export const inviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: byUserOrIp,
  skip,
  message,
});

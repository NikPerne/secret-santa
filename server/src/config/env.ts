import { z } from 'zod';

const bool = z
  .string()
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().optional().default(''),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  CLIENT_URL: z.string().url().default('http://localhost:4200'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  DEV_INSTANT_JOIN: bool,

  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),
  CLOUDINARY_FOLDER: z.string().optional().default('secret-santa'),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  MAIL_FROM: z.string().default('Secret Santa <santa@example.com>'),

  VAPID_PUBLIC_KEY: z.string().optional().default(''),
  VAPID_PRIVATE_KEY: z.string().optional().default(''),
  VAPID_SUBJECT: z.string().optional().default('mailto:santa@example.com'),

  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(60),
  DAILY_JOB_CRON: z.string().default('0 8 * * *'),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse({
    ...process.env,
    JWT_SECRET:
      process.env.JWT_SECRET ||
      (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-secret-change-me'),
  });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;
  if (env.NODE_ENV === 'production' && !env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required in production');
  }
  return env;
}

export const env = load();

export const isProd = env.NODE_ENV === 'production';
export const instantJoinEnabled = !isProd && env.DEV_INSTANT_JOIN;
export const cloudinaryEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);
export const smtpEnabled = Boolean(env.SMTP_HOST);
export const pushEnabled = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

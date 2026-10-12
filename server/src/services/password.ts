import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/** scrypt parameters (N=2^15, r=8, p=1 ≈ 32 MB, ~50 ms): fine for Render's 512 MB instance. */
const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 200;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, KEY_LENGTH, { ...opts, maxmem: MAX_MEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** Returns `scrypt$N$r$p$salt$hash` (base64url), so parameters can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = stored?.split('$');
  if (!parts || parts.length !== 6 || parts[0] !== 'scrypt') {
    // Same work as a real check, so response time doesn't reveal whether the account exists.
    await derive(password, randomBytes(16), { N, r: R, p: P });
    return false;
  }
  const [, n, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, 'base64url');
  const key = await derive(password, Buffer.from(salt, 'base64url'), { N: +n, r: +r, p: +p });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

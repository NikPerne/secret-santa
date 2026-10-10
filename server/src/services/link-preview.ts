import { lookup } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';

/**
 * Fetches a shop page and extracts title, image and price from its Open Graph / meta tags.
 *
 * Safety (the URL comes from users): only http(s) on default ports; every connection is checked
 * at connect time so private, loopback and link-local addresses can't be reached (no SSRF, also
 * after redirects or DNS tricks); at most 3 redirects, 1 MB of HTML and 8 seconds.
 */

const MAX_BYTES = 1024 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

export interface LinkMeta {
  title: string | null;
  siteName: string | null;
  imageUrl: string | null;
  price: number | null;
  currency: string | null;
}

export class LinkPreviewError extends Error {}

/** True for addresses a server-side fetch must never reach. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (isIP(v4) === 4) {
    const [a, b] = v4.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return (
    v6 === '::' ||
    v6 === '::1' ||
    v6.startsWith('fc') ||
    v6.startsWith('fd') ||
    v6.startsWith('fe8') ||
    v6.startsWith('fe9') ||
    v6.startsWith('fea') ||
    v6.startsWith('feb') ||
    v6.startsWith('ff')
  );
}

/** DNS lookup that refuses private addresses, used for the actual socket connection. */
const safeLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0);
    const list = addresses as unknown as Array<{ address: string; family: number }>;
    const allowed = list.find((a) => !isPrivateAddress(a.address));
    if (!allowed || list.some((a) => isPrivateAddress(a.address))) {
      return callback(new LinkPreviewError('Blocked address'), '', 0);
    }
    if ((options as { all?: boolean }).all) {
      return (callback as unknown as (e: null, a: typeof list) => void)(null, [allowed]);
    }
    callback(null, allowed.address, allowed.family);
  });
};

export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LinkPreviewError('Invalid URL');
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new LinkPreviewError('Only http(s) links');
  if (url.port && !['80', '443'].includes(url.port)) throw new LinkPreviewError('Unusual port');
  if (url.username || url.password) throw new LinkPreviewError('Credentials in URL');
  if (isIP(url.hostname.replace(/^\[|\]$/g, '')) && isPrivateAddress(url.hostname.replace(/^\[|\]$/g, ''))) {
    throw new LinkPreviewError('Blocked address');
  }
  return url;
}

function getOnce(
  url: URL,
): Promise<{ status: number; location?: string; body: string; contentType: string }> {
  const client = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          // Many shops only send Open Graph tags to browsers or link-preview bots.
          'User-Agent': 'Mozilla/5.0 (compatible; SecretSantaBot/1.0; link preview)',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Encoding': 'identity',
          'Accept-Language': 'sl,en;q=0.8',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers['content-type'] ?? '');
        if (status >= 300 && status < 400) {
          res.resume();
          return resolve({ status, location: res.headers.location, body: '', contentType });
        }
        if (!/html/i.test(contentType)) {
          res.destroy();
          return resolve({ status, body: '', contentType });
        }
        let size = 0;
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          chunks.push(chunk);
          // Meta tags live in <head>: stop once we have enough.
          if (size >= MAX_BYTES) res.destroy();
        });
        const done = () => resolve({ status, body: Buffer.concat(chunks).toString('utf8'), contentType });
        res.on('end', done);
        res.on('close', done);
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new LinkPreviewError('Timed out')));
    req.on('error', reject);
  });
}

/** Fetches HTML following up to 3 redirects, each one re-checked. Returns the final URL too. */
export async function fetchHtml(raw: string): Promise<{ url: URL; html: string }> {
  let url = checkUrl(raw);
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await getOnce(url);
    if (res.location && res.status >= 300 && res.status < 400) {
      url = checkUrl(new URL(res.location, url).toString());
      continue;
    }
    if (res.status >= 400) throw new LinkPreviewError(`HTTP ${res.status}`);
    return { url, html: res.body };
  }
  throw new LinkPreviewError('Too many redirects');
}

const decodeEntities = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([a-zA-Z:_-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '');
  }
  return out;
}

const clean = (s: string | undefined | null, max = 120) => {
  const v = s?.replace(/\s+/g, ' ').trim();
  return v ? v.slice(0, max) : null;
};

/** Extracts preview data from HTML. Pure, so it's unit-testable. */
export function parseMeta(html: string, baseUrl: URL): LinkMeta {
  const meta: Record<string, string> = {};
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const a = attributes(m[0]);
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase();
    if (key && a.content !== undefined && !(key in meta)) meta[key] = a.content;
  }
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  const rawImage = meta['og:image:secure_url'] ?? meta['og:image'] ?? meta['twitter:image'] ?? meta['image'];
  let imageUrl: string | null = null;
  if (rawImage) {
    try {
      const u = new URL(rawImage, baseUrl);
      if (u.protocol === 'https:' || u.protocol === 'http:') imageUrl = u.toString();
    } catch {
      /* ignore bad image URLs */
    }
  }

  const rawPrice = meta['product:price:amount'] ?? meta['og:price:amount'] ?? meta['price'];
  const price = rawPrice ? Number(rawPrice.replace(/\s/g, '').replace(',', '.')) : NaN;

  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? (titleTag ? decodeEntities(titleTag) : null)),
    siteName: clean(meta['og:site_name'], 60),
    imageUrl,
    price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : null,
    currency: clean(meta['product:price:currency'] ?? meta['og:price:currency'] ?? meta['pricecurrency'], 3),
  };
}

// Small in-memory cache so the same link isn't fetched over and over (saves bandwidth).
const cache = new Map<string, { at: number; meta: LinkMeta }>();
const CACHE_MS = 60 * 60 * 1000;

export async function getLinkMeta(raw: string): Promise<LinkMeta> {
  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.meta;
  const { url, html } = await fetchHtml(raw);
  const meta = parseMeta(html, url);
  cache.set(raw, { at: Date.now(), meta });
  if (cache.size > 200) cache.delete(cache.keys().next().value as string);
  return meta;
}

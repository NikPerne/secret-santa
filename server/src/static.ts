import express, { type Express } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './utils/logger.js';

/** Angular production build, relative to both src/ (tsx) and dist/ (node). */
export const DEFAULT_STATIC_DIR = fileURLToPath(new URL('../../client/dist/client/browser', import.meta.url));

const ONE_YEAR = 60 * 60 * 24 * 365;
const ONE_DAY = 60 * 60 * 24;
/** Files that must always be revalidated so app and service-worker updates arrive promptly. */
const NO_CACHE = new Set([
  'index.html',
  'ngsw.json',
  'ngsw-worker.js',
  'safety-worker.js',
  'worker-basic.min.js',
  'manifest.webmanifest',
]);
/** Angular's content-hashed output, e.g. main-7JICQXVO.js, chunk-BnlcuLTw.js, styles-NEXHE6FC.css */
const HASHED = /-[A-Za-z0-9_]{8}\.(js|css)$/;

function cacheControl(filePath: string): string {
  const name = filePath.split(/[\\/]/).pop() ?? '';
  if (NO_CACHE.has(name)) return 'no-cache';
  if (HASHED.test(name)) return `public, max-age=${ONE_YEAR}, immutable`;
  return `public, max-age=${ONE_DAY}`;
}

/**
 * Serves the Angular PWA from the API process, so the whole app runs as a single Render web
 * service on one origin. Hashed bundles are cached for a year (they change name on every build),
 * so returning visitors and the service worker download almost nothing.
 */
export function serveClient(app: Express, dir = process.env.STATIC_DIR || DEFAULT_STATIC_DIR): boolean {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    logger.info(`No client build at ${dir}: serving the API only`);
    return false;
  }

  app.use(
    express.static(dir, {
      index: false,
      setHeaders: (res, filePath) => res.setHeader('Cache-Control', cacheControl(filePath)),
    }),
  );

  // SPA fallback for deep links (/g/123/reveal). Paths with a file extension stay 404 so a
  // missing old chunk after a deploy isn't answered with HTML.
  app.use((req, res, next) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/')) return next();
    if (/\.[a-z0-9]+$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
  return true;
}

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const dir = mkdtempSync(join(tmpdir(), 'ss-client-'));
writeFileSync(join(dir, 'index.html'), '<!doctype html><app-root></app-root>');
writeFileSync(join(dir, 'main-7JICQXVO.js'), `console.log(${JSON.stringify('x'.repeat(5000))});`);
writeFileSync(join(dir, 'ngsw-worker.js'), '// sw');
writeFileSync(join(dir, 'manifest.webmanifest'), '{}');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const app = createApp({ staticDir: dir });

describe('serving the Angular app from the API', () => {
  it('caches hashed bundles for a year and gzips them', async () => {
    const res = await request(app).get('/main-7JICQXVO.js').set('Accept-Encoding', 'gzip');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(res.headers['content-encoding']).toBe('gzip');
  });

  it('always revalidates the app shell and service worker', async () => {
    for (const path of ['/ngsw-worker.js', '/manifest.webmanifest']) {
      expect((await request(app).get(path)).headers['cache-control']).toBe('no-cache');
    }
  });

  it('serves index.html for deep links', async () => {
    const res = await request(app).get('/g/123/reveal').set('Accept', 'text/html');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<app-root>');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.headers['content-security-policy']).toContain(
      "img-src 'self' data: blob: https://res.cloudinary.com",
    );
  });

  it('keeps 404s for missing files and unknown API routes', async () => {
    expect((await request(app).get('/chunk-OLDOLDOL.js')).status).toBe(404);
    const api = await request(app).get('/api/nope');
    expect(api.status).toBe(404);
    expect(api.body.error.code).toBe('not_found');
  });
});

import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('responds ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });
});

describe('parseFrom', () => {
  it('splits a display name and address', async () => {
    const { parseFrom } = await import('../src/services/email.js');
    expect(parseFrom('Secret Santa <santa@example.com>')).toEqual({
      name: 'Secret Santa',
      email: 'santa@example.com',
    });
    expect(parseFrom('"Santa" <a@b.c>')).toEqual({ name: 'Santa', email: 'a@b.c' });
    expect(parseFrom('a@b.c')).toEqual({ email: 'a@b.c' });
  });
});

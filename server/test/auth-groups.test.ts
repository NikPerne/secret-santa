import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { LoginTokenModel } from '../src/models/index.js';
import { devOutbox } from '../src/services/email.js';
import { app, createGroupWith, signIn, useDatabase } from './helpers.js';

useDatabase();

function tokenFromLink(link: string): string {
  return new URL(link).searchParams.get('token')!;
}

describe('magic link auth', () => {
  it('sends a link, stores only a hash, and signs in exactly once', async () => {
    const res = await request(app)
      .post('/api/auth/request-link')
      .send({ email: 'Ana@Example.com', name: 'Ana' });
    expect(res.status).toBe(200);
    expect(res.body.devLink).toContain('/auth/verify?token=');
    expect(devOutbox.at(-1)?.to).toBe('ana@example.com');

    const token = tokenFromLink(res.body.devLink);
    const stored = await LoginTokenModel.findOne({ email: 'ana@example.com' });
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toHaveLength(64);

    const agent = request.agent(app);
    const verify = await agent.post('/api/auth/verify').send({ token });
    expect(verify.status).toBe(200);
    expect(verify.body.user.name).toBe('Ana');
    const cookie = verify.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/ss_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    const me = await agent.get('/api/auth/me');
    expect(me.body.user.email).toBe('ana@example.com');

    const again = await request(app).post('/api/auth/verify').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid_token');
  });

  it('rejects expired tokens', async () => {
    const res = await request(app).post('/api/auth/request-link').send({ email: 'b@example.com' });
    const token = tokenFromLink(res.body.devLink);
    await LoginTokenModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const verify = await request(app).post('/api/auth/verify').send({ token });
    expect(verify.status).toBe(400);
  });

  it('rejects open redirects', async () => {
    const res = await request(app)
      .post('/api/auth/request-link')
      .send({ email: 'c@example.com', redirect: '//evil.com' });
    expect(res.status).toBe(400);
  });

  it('joins the invited group on verify', async () => {
    const { group } = await createGroupWith(['Org']);
    const res = await request(app)
      .post('/api/auth/request-link')
      .send({ email: 'new@example.com', name: 'Newbie', inviteCode: group.inviteCode });
    const agent = request.agent(app);
    const verify = await agent.post('/api/auth/verify').send({ token: tokenFromLink(res.body.devLink) });
    expect(verify.body.groupId).toBe(group.id);
    const detail = await agent.get(`/api/groups/${group.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.members.map((m: { name: string }) => m.name)).toEqual(['Org', 'Newbie']);
  });

  it('logs out', async () => {
    const { agent } = await signIn('d@example.com');
    await agent.post('/api/auth/logout');
    const me = await agent.get('/api/auth/me');
    expect(me.body.user).toBeNull();
  });
});

describe('groups', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/groups')).status).toBe(401);
  });

  it('creates a group and lists it', async () => {
    const { agent } = await signIn('org@example.com', 'Org');
    const created = await agent.post('/api/groups').send({
      name: 'Family 2026',
      exchangeDate: '2026-12-24',
      budget: { amount: 30, currency: 'eur' },
    });
    expect(created.status).toBe(201);
    expect(created.body.group.budget).toEqual({ amount: 30, currency: 'EUR' });
    expect(created.body.group.inviteCode).toMatch(/^[A-Za-z0-9]{8}$/);
    const list = await agent.get('/api/groups');
    expect(list.body.groups).toHaveLength(1);
    expect(list.body.groups[0].role).toBe('organizer');
    expect(list.body.groups[0].memberCount).toBe(1);
  });

  it('hides groups from non-members with a 404', async () => {
    const { group } = await createGroupWith(['Org', 'Ana']);
    const { agent } = await signIn('stranger@example.com');
    expect((await agent.get(`/api/groups/${group.id}`)).status).toBe(404);
  });

  it('only lets the organizer edit settings and exclusions', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    const [, ana, bo] = members;
    expect((await ana.agent.patch(`/api/groups/${group.id}`).send({ name: 'Hacked' })).status).toBe(403);
    expect((await ana.agent.put(`/api/groups/${group.id}/exclusions`).send({ exclusions: [] })).status).toBe(
      403,
    );

    const ok = await organizer.agent.put(`/api/groups/${group.id}/exclusions`).send({
      exclusions: [
        { a: ana.user.id, b: bo.user.id },
        { a: bo.user.id, b: ana.user.id },
      ],
    });
    expect(ok.status).toBe(200);
    expect(ok.body.group.exclusions).toHaveLength(1);

    const participantView = await ana.agent.get(`/api/groups/${group.id}`);
    expect(participantView.body.group.exclusions).toBeUndefined();
  });

  it('shows a public invite preview and joins idempotently', async () => {
    const { group } = await createGroupWith(['Org']);
    const preview = await request(app).get(`/api/invites/${group.inviteCode}`);
    expect(preview.body.invite).toMatchObject({ name: 'Test group', organizerName: 'Org', memberCount: 1 });
    expect(preview.body.invite.groupId).toBeUndefined();

    const { agent } = await signIn('eve@example.com', 'Eve');
    expect((await agent.post(`/api/invites/${group.inviteCode}/join`)).body.joined).toBe(true);
    expect((await agent.post(`/api/invites/${group.inviteCode}/join`)).body.joined).toBe(false);
    expect((await request(app).get('/api/invites/nope1234')).status).toBe(404);
  });

  it('deletes a group with its memberships', async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana']);
    expect((await members[1].agent.delete(`/api/groups/${group.id}`)).status).toBe(403);
    expect((await organizer.agent.delete(`/api/groups/${group.id}`)).status).toBe(200);
    expect((await members[1].agent.get('/api/groups')).body.groups).toHaveLength(0);
  });
});

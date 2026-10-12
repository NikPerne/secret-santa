import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { PasswordTokenModel, UserModel } from '../src/models/index.js';
import { devOutbox } from '../src/services/email.js';
import { app, createGroupWith, signIn, useDatabase } from './helpers.js';

useDatabase();

function tokenFromLink(link: string): string {
  return new URL(link).searchParams.get('token')!;
}

/** The admin registers someone; returns the emailed setup link. */
async function register(name: string, email: string) {
  const admin = await signIn('boss@example.com', 'Boss');
  const res = await admin.agent.post('/api/admin/users').send({ name, email });
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.body)}`);
  return { admin, user: res.body.user as { id: string }, link: res.body.devLink as string };
}

async function registerWithPassword(name: string, email: string, password = 'correct horse') {
  const { admin, user, link } = await register(name, email);
  await request(app)
    .post('/api/auth/set-password')
    .send({ token: tokenFromLink(link), password });
  return { admin, user };
}

const login = (email: string, password: string, agent = request(app)) =>
  agent.post('/api/auth/login').send({ email, password });

describe('password accounts', () => {
  it('admin registers a user, who sets a password from the emailed link exactly once', async () => {
    const { link } = await register('Ana', 'Ana@Example.com');
    expect(link).toContain('/auth/set-password?token=');
    expect(devOutbox.at(-1)?.to).toBe('ana@example.com');

    const token = tokenFromLink(link);
    const stored = await PasswordTokenModel.findOne({ purpose: 'setup' });
    expect(stored?.tokenHash).not.toBe(token);
    expect(stored?.tokenHash).toHaveLength(64);

    const check = await request(app).post('/api/auth/password-token').send({ token });
    expect(check.body).toMatchObject({ name: 'Ana', email: 'ana@example.com', purpose: 'setup' });

    const short = await request(app).post('/api/auth/set-password').send({ token, password: 'short' });
    expect(short.status).toBe(400);

    const agent = request.agent(app);
    const set = await agent.post('/api/auth/set-password').send({ token, password: 'correct horse' });
    expect(set.status).toBe(200);
    expect(set.body.user.name).toBe('Ana');
    const cookie = set.headers['set-cookie']?.[0] ?? '';
    expect(cookie).toMatch(/ss_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe('ana@example.com');

    const again = await request(app).post('/api/auth/set-password').send({ token, password: 'another one' });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe('invalid_token');

    const user = await UserModel.findOne({ email: 'ana@example.com' }).select('+passwordHash');
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(set.body)).not.toContain('scrypt');
  });

  it('signs in with email and password, and rejects wrong ones the same way', async () => {
    await registerWithPassword('Bo', 'bo@example.com');
    const agent = request.agent(app);
    expect((await login('BO@example.com', 'correct horse', agent)).status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Bo');

    const wrong = await login('bo@example.com', 'nope nope');
    const unknown = await login('ghost@example.com', 'correct horse');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_credentials');
    expect(unknown.body.error.code).toBe('invalid_credentials');
  });

  it('cannot sign in before the password is set', async () => {
    await register('Cy', 'cy@example.com');
    expect((await login('cy@example.com', 'anything1')).status).toBe(401);
  });

  it('rejects expired links', async () => {
    const { link } = await register('Di', 'di@example.com');
    await PasswordTokenModel.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app)
      .post('/api/auth/set-password')
      .send({ token: tokenFromLink(link), password: 'correct horse' });
    expect(res.status).toBe(400);
  });

  it('only admins can register people and list users', async () => {
    const { agent } = await signIn('regular@example.com');
    const body = { name: 'X', email: 'x@example.com' };
    expect((await agent.post('/api/admin/users').send(body)).status).toBe(403);
    expect((await agent.get('/api/admin/users')).status).toBe(403);
    expect((await request(app).post('/api/admin/users').send(body)).status).toBe(401);
  });

  it('does not register the same email twice', async () => {
    const { admin } = await register('Ed', 'ed@example.com');
    const dup = await admin.agent.post('/api/admin/users').send({ name: 'Other', email: 'ED@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('email_taken');
  });

  it('lists users with their password status', async () => {
    const { admin } = await registerWithPassword('Fi', 'fi@example.com');
    await admin.agent.post('/api/admin/users').send({ name: 'Gus', email: 'gus@example.com' });
    const res = await admin.agent.get('/api/admin/users');
    expect(res.status).toBe(200);
    const byEmail = Object.fromEntries(
      res.body.users.map((u: { email: string; hasPassword: boolean }) => [u.email, u.hasPassword]),
    );
    expect(byEmail).toMatchObject({ 'fi@example.com': true, 'gus@example.com': false });
    expect(JSON.stringify(res.body)).not.toContain('scrypt');
  });

  it('admin reset link sets a new password and signs out old sessions', async () => {
    const { admin, user } = await registerWithPassword('Hana', 'hana@example.com');
    const old = request.agent(app);
    await login('hana@example.com', 'correct horse', old);

    const reset = await admin.agent.post(`/api/admin/users/${user.id}/password-link`);
    expect(reset.body).toMatchObject({ sent: true, purpose: 'reset' });
    expect(devOutbox.at(-1)?.subject).toMatch(/gesla/);

    // Until the link is used, the old password keeps working.
    expect((await old.get('/api/auth/me')).body.user).not.toBeNull();
    await request(app)
      .post('/api/auth/set-password')
      .send({ token: tokenFromLink(reset.body.devLink), password: 'brand new pw' });

    expect((await old.get('/api/auth/me')).body.user).toBeNull();
    expect((await login('hana@example.com', 'correct horse')).status).toBe(401);
    expect((await login('hana@example.com', 'brand new pw')).status).toBe(200);
  });

  it('a newer link replaces an older one', async () => {
    const { admin, user, link } = await register('Ivo', 'ivo@example.com');
    await admin.agent.post(`/api/admin/users/${user.id}/password-link`);
    const res = await request(app)
      .post('/api/auth/set-password')
      .send({ token: tokenFromLink(link), password: 'correct horse' });
    expect(res.status).toBe(400);
  });

  it('users change their own password with the current one', async () => {
    await registerWithPassword('Jan', 'jan@example.com');
    const agent = request.agent(app);
    await login('jan@example.com', 'correct horse', agent);
    const other = request.agent(app);
    await login('jan@example.com', 'correct horse', other);

    const wrong = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'not it at all', newPassword: 'new password' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe('wrong_password');

    const ok = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: 'correct horse', newPassword: 'new password' });
    expect(ok.status).toBe(200);
    // This device stays signed in, the other one is signed out.
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Jan');
    expect((await other.get('/api/auth/me')).body.user).toBeNull();
    expect((await login('jan@example.com', 'new password')).status).toBe(200);
  });

  it('first-time admin setup only works for ADMIN_EMAILS without a password', async () => {
    const stranger = await request(app).post('/api/auth/admin-setup').send({ email: 'nobody@example.com' });
    expect(stranger.body).toEqual({ sent: true });
    expect(await UserModel.exists({ email: 'nobody@example.com' })).toBeNull();

    const first = await request(app).post('/api/auth/admin-setup').send({ email: 'boss@example.com' });
    expect(first.body.devLink).toContain('/auth/set-password?token=');
    const agent = request.agent(app);
    await agent
      .post('/api/auth/set-password')
      .send({ token: tokenFromLink(first.body.devLink), password: 'boss password' });
    expect((await agent.get('/api/auth/me')).body.user.isAdmin).toBe(true);

    const again = await request(app).post('/api/auth/admin-setup').send({ email: 'boss@example.com' });
    expect(again.body).toEqual({ sent: true });
  });

  it('admin deletes a user: removed from groups, groups they organize are deleted', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    const [org, ana, bo] = members;
    const admin = await signIn('boss@example.com', 'Boss');

    expect((await admin.agent.delete(`/api/admin/users/${ana.user.id}`)).status).toBe(200);
    expect(await UserModel.exists({ email: 'ana@example.com' })).toBeNull();
    expect((await ana.agent.get('/api/auth/me')).body.user).toBeNull();
    const detail = await bo.agent.get(`/api/groups/${group.id}`);
    expect(detail.body.members.map((m: { name: string }) => m.name)).toEqual(['Org', 'Bo']);

    await admin.agent.delete(`/api/admin/users/${org.user.id}`);
    expect((await bo.agent.get(`/api/groups/${group.id}`)).status).toBe(404);

    const users = await admin.agent.get('/api/admin/users');
    expect(users.body.users.map((u: { name: string }) => u.name).sort()).toEqual(['Bo', 'Boss']);
  });

  it('admins cannot delete themselves here, and only admins can delete', async () => {
    const admin = await signIn('boss@example.com', 'Boss');
    const self = await admin.agent.delete(`/api/admin/users/${admin.user.id}`);
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('cannot_delete_self');

    const regular = await signIn('regular@example.com');
    expect((await regular.agent.delete(`/api/admin/users/${admin.user.id}`)).status).toBe(403);
    expect(await UserModel.exists({ email: 'boss@example.com' })).not.toBeNull();

    const missing = await admin.agent.delete('/api/admin/users/64b000000000000000000000');
    expect(missing.status).toBe(404);
  });

  it('the old magic-link endpoints are gone', async () => {
    const res = await request(app).post('/api/auth/request-link').send({ email: 'a@example.com' });
    expect(res.status).toBe(404);
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

describe('profile picture', () => {
  it('starts empty, rejects foreign images and can be removed', async () => {
    const { agent } = await signIn('pic@example.com', 'Pic');
    expect((await agent.get('/api/auth/me')).body.user.avatar).toBeNull();

    const foreign = await agent
      .patch('/api/auth/me')
      .send({ avatar: { url: 'https://evil.example/me.jpg', publicId: 'secret-santa/users/x/avatar/me' } });
    expect(foreign.status).toBe(400);
    expect(foreign.body.error.code).toBe('invalid_image');

    const cleared = await agent.patch('/api/auth/me').send({ avatar: null });
    expect(cleared.body.user.avatar).toBeNull();
  });

  it('asks for a signature without a group (disabled without Cloudinary)', async () => {
    const { agent } = await signIn('pic2@example.com');
    const res = await agent.post('/api/uploads/signature').send({ purpose: 'avatar' });
    expect(res.status).toBe(503);
    expect((await agent.post('/api/uploads/signature').send({ purpose: 'wishlist' })).status).toBe(400);
  });

  it('shows member pictures (null when none) in the group', async () => {
    const { group, organizer } = await createGroupWith(['Org', 'Ana']);
    const detail = await organizer.agent.get(`/api/groups/${group.id}`);
    expect(detail.body.members.every((m: { avatarUrl: unknown }) => m.avatarUrl === null)).toBe(true);
  });
});

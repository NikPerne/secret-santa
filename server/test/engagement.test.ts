import { describe, expect, it } from 'vitest';
import { devOutbox } from '../src/services/email.js';
import { createGroupWith, signIn, useDatabase } from './helpers.js';

useDatabase();

async function drawn(names = ['Org', 'Ana', 'Bo', 'Cy']) {
  const ctx = await createGroupWith(names);
  await ctx.organizer.agent.post(`/api/groups/${ctx.group.id}/draw`).send({ confirm: true });
  const matchOf = new Map<string, string>();
  for (const m of ctx.members) {
    matchOf.set(m.user.id, (await m.agent.get(`/api/groups/${ctx.group.id}/match`)).body.match.id);
  }
  return { ...ctx, matchOf };
}

describe('unread chat badges', () => {
  it('counts new messages until the chat is opened', async () => {
    const { group, members, matchOf } = await drawn();
    const santa = members[1];
    const giftee = members.find((m) => m.user.id === matchOf.get(santa.user.id))!;
    const base = `/api/groups/${group.id}`;

    await santa.agent.post(`${base}/chat/match`).send({ text: 'Hi!' });
    await santa.agent.post(`${base}/chat/match`).send({ text: 'Tea or coffee?' });

    expect((await giftee.agent.get(`${base}/chat-unread`)).body.unread).toEqual({ match: 0, santa: 2 });
    const list = await giftee.agent.get('/api/groups');
    expect(list.body.groups[0].unread).toBe(2);
    // The sender's own messages never count as unread for them.
    expect((await santa.agent.get(`${base}/chat-unread`)).body.unread).toEqual({ match: 0, santa: 0 });

    await giftee.agent.get(`${base}/chat/santa`);
    expect((await giftee.agent.get(`${base}/chat-unread`)).body.unread.santa).toBe(0);
  });
});

describe('organizer nudge', () => {
  it('reminds someone who has not unwrapped, once per day', async () => {
    const { group, organizer, members } = await drawn();
    const ana = members[1];
    devOutbox.length = 0;
    const res = await organizer.agent.post(`/api/groups/${group.id}/members/${ana.user.id}/nudge`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('nudgeReveal');
    expect(devOutbox.at(-1)?.to).toBe('ana@example.com');

    const again = await organizer.agent.post(`/api/groups/${group.id}/members/${ana.user.id}/nudge`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('already_nudged');
  });

  it('only the organizer can nudge, and only when there is something to nudge about', async () => {
    const { group, organizer, members } = await drawn();
    const ana = members[1];
    expect((await ana.agent.post(`/api/groups/${group.id}/members/${organizer.user.id}/nudge`)).status).toBe(
      403,
    );

    await ana.agent.post(`/api/groups/${group.id}/match/viewed`);
    await ana.agent.post(`/api/groups/${group.id}/wishlist`).send({ title: 'Socks' });
    const res = await organizer.agent.post(`/api/groups/${group.id}/members/${ana.user.id}/nudge`);
    expect(res.body.error.code).toBe('nothing_to_nudge');
  });
});

describe('invite by email', () => {
  it('emails the invite link and skips existing members', async () => {
    const { group, organizer } = await createGroupWith(['Org', 'Ana']);
    devOutbox.length = 0;
    const res = await organizer.agent
      .post(`/api/groups/${group.id}/invite-emails`)
      .send({ emails: ['new@example.com', 'NEW@example.com', 'ana@example.com'] });
    expect(res.body).toEqual({ sent: 1, skipped: 1 });
    expect(devOutbox).toHaveLength(1);
    expect(devOutbox[0].text).toContain(`/join/${group.inviteCode}`);
  });

  it('is organizer-only and validates addresses', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    expect(
      (
        await members[1].agent
          .post(`/api/groups/${group.id}/invite-emails`)
          .send({ emails: ['x@example.com'] })
      ).status,
    ).toBe(403);
    const { agent } = await signIn('o2@example.com');
    const g = await agent.post('/api/groups').send({ name: 'G' });
    expect(
      (await agent.post(`/api/groups/${g.body.group.id}/invite-emails`).send({ emails: ['nope'] })).status,
    ).toBe(400);
  });
});

describe('anonymous thank-you note', () => {
  it('opens after the exchange and reaches the Santa without revealing them', async () => {
    const { group, members, matchOf } = await drawn();
    const giftee = members[1];
    const santa = members.find((m) => matchOf.get(m.user.id) === giftee.user.id)!;
    const base = `/api/groups/${group.id}/thank-you`;

    expect((await giftee.agent.put(base).send({ text: 'Thanks!' })).body.error.code).toBe('too_early');

    const { GroupModel } = await import('../src/models/index.js');
    await GroupModel.updateOne({ _id: group.id }, { exchangeDate: new Date(Date.now() - 1000) });

    const state = await giftee.agent.get(base);
    expect(state.body).toMatchObject({ canSend: true, sent: null });
    devOutbox.length = 0;
    const sent = await giftee.agent.put(base).send({ text: 'The socks are perfect, thank you!' });
    expect(sent.body.sent.text).toBe('The socks are perfect, thank you!');
    expect(devOutbox.filter((m) => m.to === santa.user.email)).toHaveLength(1);

    const santaView = await santa.agent.get(base);
    expect(santaView.body.received.text).toBe('The socks are perfect, thank you!');
    // The giftee's view never names the Santa.
    expect(JSON.stringify(state.body)).not.toContain(santa.user.name);

    // Editing doesn't notify again.
    await giftee.agent.put(base).send({ text: 'Edited thanks' });
    expect(devOutbox.filter((m) => m.to === santa.user.email)).toHaveLength(1);
  });
});

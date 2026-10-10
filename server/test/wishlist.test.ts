import { describe, expect, it } from 'vitest';
import { createGroupWith, useDatabase } from './helpers.js';

useDatabase();

describe('wishlists and preferences', () => {
  it('creates, edits, reorders and deletes items', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const ana = members[1].agent;
    const base = `/api/groups/${group.id}/wishlist`;

    const a = await ana.post(base).send({ title: 'Mug', price: 12.5, url: 'https://shop.example/mug' });
    expect(a.status).toBe(201);
    const b = await ana.post(base).send({ title: 'Socks', notes: 'Size 42' });
    expect(b.body.item.order).toBe(1);

    expect((await ana.post(base).send({ title: 'Bad', url: 'javascript:alert(1)' })).status).toBe(400);
    expect((await ana.post(base).send({ title: '' })).status).toBe(400);

    const edited = await ana.patch(`${base}/${a.body.item.id}`).send({ title: 'Big mug' });
    expect(edited.body.item.title).toBe('Big mug');

    const ordered = await ana.put(`${base}/order`).send({ ids: [b.body.item.id, a.body.item.id] });
    expect(ordered.body.items.map((i: { title: string }) => i.title)).toEqual(['Socks', 'Big mug']);

    expect((await ana.delete(`${base}/${b.body.item.id}`)).status).toBe(200);
    expect((await ana.get(base)).body.items).toHaveLength(1);
  });

  it('rejects images that were not uploaded through the app', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const res = await members[1].agent.post(`/api/groups/${group.id}/wishlist`).send({
      title: 'Lamp',
      image: { url: 'https://evil.example/x.jpg', publicId: 'x' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_image');
  });

  it('lets members edit only their own items', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana', 'Bo']);
    const [, ana, bo] = members;
    const item = await ana.agent.post(`/api/groups/${group.id}/wishlist`).send({ title: 'Book' });
    const id = item.body.item.id;
    expect((await bo.agent.patch(`/api/groups/${group.id}/wishlist/${id}`).send({ title: 'x' })).status).toBe(
      404,
    );
    expect((await bo.agent.delete(`/api/groups/${group.id}/wishlist/${id}`)).status).toBe(404);
  });

  it("shows a Santa only their own match's wishlist and preferences", async () => {
    const { group, organizer, members } = await createGroupWith(['Org', 'Ana', 'Bo', 'Cy']);
    for (const m of members) {
      await m.agent.post(`/api/groups/${group.id}/wishlist`).send({ title: `${m.user.name}'s wish` });
      await m.agent
        .put(`/api/groups/${group.id}/preferences`)
        .send({ dislikes: `no spiders for ${m.user.name}` });
    }
    expect((await members[1].agent.get(`/api/groups/${group.id}/match/wishlist`)).status).toBe(409);
    await organizer.agent.post(`/api/groups/${group.id}/draw`).send({ confirm: true });

    for (const m of members) {
      const match = await m.agent.get(`/api/groups/${group.id}/match`);
      const receiverName = members.find((x) => x.user.id === match.body.match.id)!.user.name;
      const wl = await m.agent.get(`/api/groups/${group.id}/match/wishlist`);
      expect(wl.body.items).toHaveLength(1);
      expect(wl.body.items[0].title).toBe(`${receiverName}'s wish`);
      expect(wl.body.preferences.dislikes).toBe(`no spiders for ${receiverName}`);
    }
  });

  it('reports uploads as disabled without Cloudinary credentials', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const res = await members[1].agent
      .post('/api/uploads/signature')
      .send({ groupId: group.id, purpose: 'wishlist' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('uploads_disabled');
  });
});

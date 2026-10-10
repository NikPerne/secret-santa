import { describe, expect, it } from 'vitest';
import { checkUrl, isPrivateAddress, parseMeta } from '../src/services/link-preview.js';
import { createGroupWith, useDatabase } from './helpers.js';

useDatabase();

describe('link preview parsing', () => {
  const base = new URL('https://shop.example.si/izdelki/med');

  it('reads Open Graph title, image, site and price', () => {
    const html = `<html><head>
      <title>Fallback title</title>
      <meta property="og:title" content="Cvetlični med &amp; propolis 500 g">
      <meta property="og:site_name" content="Čebelarstvo Novak">
      <meta property="og:image" content="/img/med.jpg">
      <meta property="product:price:amount" content="12,90">
      <meta property="product:price:currency" content="EUR">
    </head></html>`;
    expect(parseMeta(html, base)).toEqual({
      title: 'Cvetlični med & propolis 500 g',
      siteName: 'Čebelarstvo Novak',
      imageUrl: 'https://shop.example.si/img/med.jpg',
      price: 12.9,
      currency: 'EUR',
    });
  });

  it('falls back to <title> and twitter tags', () => {
    const html = `<title>  Volnene
      nogavice </title><meta name="twitter:image" content="https://cdn.example.com/n.png">`;
    const meta = parseMeta(html, base);
    expect(meta.title).toBe('Volnene nogavice');
    expect(meta.imageUrl).toBe('https://cdn.example.com/n.png');
    expect(meta.price).toBeNull();
  });

  it('ignores non-http image URLs', () => {
    expect(parseMeta('<meta property="og:image" content="javascript:alert(1)">', base).imageUrl).toBeNull();
  });
});

describe('link preview safety', () => {
  it('blocks private, loopback and link-local addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '192.168.0.10',
      '172.20.1.1',
      '169.254.169.254',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
      '0.0.0.0',
    ]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ['8.8.8.8', '151.101.1.69', '2a00:1450:4001::200e']) {
      expect(isPrivateAddress(ip)).toBe(false);
    }
  });

  it('only accepts plain http(s) URLs on default ports', () => {
    expect(() => checkUrl('ftp://example.com')).toThrow();
    expect(() => checkUrl('http://example.com:8080/x')).toThrow();
    expect(() => checkUrl('http://user:pw@example.com')).toThrow();
    expect(() => checkUrl('http://127.0.0.1/admin')).toThrow();
    expect(() => checkUrl('http://[::1]/')).toThrow();
    expect(checkUrl('https://www.example.com/a?b=1').hostname).toBe('www.example.com');
  });

  it('refuses internal URLs through the API', async () => {
    const { group, members } = await createGroupWith(['Org', 'Ana']);
    const res = await members[1].agent
      .post(`/api/groups/${group.id}/link-preview`)
      .send({ url: 'http://169.254.169.254/latest/meta-data' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('preview_failed');
  });
});

describe('group theme', () => {
  it('stores a theme preset with optional text and shows it in the invite', async () => {
    const { group, organizer } = await createGroupWith(['Org'], {
      theme: { preset: 'slovenian', text: 'Kupljeno ali narejeno v Sloveniji' },
    });
    const detail = await organizer.agent.get(`/api/groups/${group.id}`);
    expect(detail.body.group.theme).toEqual({
      preset: 'slovenian',
      text: 'Kupljeno ali narejeno v Sloveniji',
    });
    const invite = await organizer.agent.get(`/api/invites/${group.inviteCode}`);
    expect(invite.body.invite.theme.preset).toBe('slovenian');

    const bad = await organizer.agent.patch(`/api/groups/${group.id}`).send({ theme: { preset: 'nope' } });
    expect(bad.status).toBe(400);
  });
});

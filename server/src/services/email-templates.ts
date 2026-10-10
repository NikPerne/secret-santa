export type Lang = 'en' | 'sl';

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );

function layout(title: string, paragraphs: string[], cta?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px">${escapeHtml(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${escapeHtml(cta.url)}" style="background:#c62828;color:#fff;padding:14px 24px;border-radius:24px;text-decoration:none;font-weight:bold;display:inline-block">${escapeHtml(cta.label)}</a></p>
       <p style="font-size:12px;color:#666;word-break:break-all">${escapeHtml(cta.url)}</p>`
    : '';
  return `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f6;padding:24px;color:#222">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
  <div style="font-size:40px">🎅</div>
  <h1 style="font-size:22px;margin:8px 0 16px">${escapeHtml(title)}</h1>${body}${button}
  </div></body></html>`;
}

function build(title: string, paragraphs: string[], cta?: { label: string; url: string }): EmailContent {
  const text = [title, '', ...paragraphs, ...(cta ? ['', `${cta.label}: ${cta.url}`] : [])].join('\n');
  return { subject: title, text, html: layout(title, paragraphs, cta) };
}

const T = {
  en: {
    magicLink: (name: string, url: string) =>
      build(
        'Your Secret Santa sign-in link',
        [
          `Hi ${name}!`,
          'Tap the button below to sign in. The link works once and expires in 15 minutes.',
          "If you didn't ask for this, you can ignore this email.",
        ],
        { label: 'Sign in', url },
      ),
    drawDone: (name: string, group: string, url: string) =>
      build(
        `Names have been drawn in ${group}! 🎁`,
        [`Hi ${name}!`, 'The draw is done. Open the app to unwrap who you are Secret Santa for.'],
        { label: 'Reveal my match', url },
      ),
    matchChanged: (name: string, group: string, url: string) =>
      build(
        `Your match in ${group} has changed`,
        [`Hi ${name}!`, 'Someone left the group, so you have a new person to surprise. Take a look!'],
        { label: 'See my new match', url },
      ),
    wishlistMissing: (name: string, group: string, url: string) =>
      build(
        `Help your Secret Santa in ${group}`,
        [`Hi ${name}!`, "Your wishlist is still empty. Add a few ideas so your Santa doesn't have to guess."],
        { label: 'Add wishes', url },
      ),
    exchangeSoon: (name: string, group: string, date: string, url: string) =>
      build(
        `${group}: gift exchange in 3 days`,
        [`Hi ${name}!`, `The gift exchange is on ${date}. Have you got your gift ready?`],
        { label: 'Open group', url },
      ),
  },
  sl: {
    magicLink: (name: string, url: string) =>
      build(
        'Tvoja povezava za prijavo v Skrivnega Božička',
        [
          `Živjo, ${name}!`,
          'Za prijavo tapni gumb spodaj. Povezava deluje enkrat in poteče v 15 minutah.',
          'Če tega nisi zahteval/-a, lahko to sporočilo prezreš.',
        ],
        { label: 'Prijava', url },
      ),
    drawDone: (name: string, group: string, url: string) =>
      build(
        `Žreb v skupini ${group} je opravljen! 🎁`,
        [`Živjo, ${name}!`, 'Imena so izžrebana. Odpri aplikacijo in odvij, koga obdaruješ.'],
        { label: 'Razkrij mojega obdarovanca', url },
      ),
    matchChanged: (name: string, group: string, url: string) =>
      build(
        `Tvoj obdarovanec v skupini ${group} se je spremenil`,
        [`Živjo, ${name}!`, 'Nekdo je zapustil skupino, zato imaš novo osebo za presenečenje. Poglej!'],
        { label: 'Poglej novega obdarovanca', url },
      ),
    wishlistMissing: (name: string, group: string, url: string) =>
      build(
        `Pomagaj svojemu Božičku v skupini ${group}`,
        [
          `Živjo, ${name}!`,
          'Tvoj seznam želja je še prazen. Dodaj nekaj idej, da Božičku ne bo treba ugibati.',
        ],
        { label: 'Dodaj želje', url },
      ),
    exchangeSoon: (name: string, group: string, date: string, url: string) =>
      build(
        `${group}: izmenjava daril čez 3 dni`,
        [`Živjo, ${name}!`, `Izmenjava daril bo ${date}. Je tvoje darilo že pripravljeno?`],
        { label: 'Odpri skupino', url },
      ),
  },
} satisfies Record<Lang, unknown>;

export const templates = (lang: string | null | undefined) => T[lang === 'sl' ? 'sl' : 'en'];

/** Short push-notification texts, mirroring the emails. */
export const pushTexts = {
  en: {
    drawDone: (group: string) => ({
      title: `🎁 ${group}`,
      body: 'Names are drawn! Tap to reveal your match.',
    }),
    matchChanged: (group: string) => ({ title: `🔁 ${group}`, body: 'Your match changed. Tap to see who.' }),
    wishlistMissing: (group: string) => ({
      title: `📝 ${group}`,
      body: 'Your wishlist is empty. Add a few ideas!',
    }),
    exchangeSoon: (group: string) => ({ title: `⏰ ${group}`, body: 'Gift exchange in 3 days!' }),
    newMessage: (group: string) => ({ title: `💬 ${group}`, body: 'You have a new anonymous message.' }),
  },
  sl: {
    drawDone: (group: string) => ({ title: `🎁 ${group}`, body: 'Imena so izžrebana! Tapni za razkritje.' }),
    matchChanged: (group: string) => ({
      title: `🔁 ${group}`,
      body: 'Tvoj obdarovanec se je spremenil. Tapni in poglej.',
    }),
    wishlistMissing: (group: string) => ({
      title: `📝 ${group}`,
      body: 'Tvoj seznam želja je prazen. Dodaj ideje!',
    }),
    exchangeSoon: (group: string) => ({ title: `⏰ ${group}`, body: 'Izmenjava daril čez 3 dni!' }),
    newMessage: (group: string) => ({ title: `💬 ${group}`, body: 'Imaš novo anonimno sporočilo.' }),
  },
};

export const pushText = (lang: string | null | undefined) => pushTexts[lang === 'sl' ? 'sl' : 'en'];

export function formatDate(date: Date, lang: string | null | undefined): string {
  return new Intl.DateTimeFormat(lang === 'sl' ? 'sl-SI' : 'en-GB', { dateStyle: 'long' }).format(date);
}

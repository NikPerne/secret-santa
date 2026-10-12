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
    accountSetup: (name: string, email: string, url: string) =>
      build(
        'Your Secret Santa account is ready 🎅',
        [
          `Hi ${name}!`,
          `An account was created for you. You will sign in with your email (${email}) and a password.`,
          'Tap the button below to choose your password. The link works once and expires in 7 days.',
        ],
        { label: 'Set my password', url },
      ),
    passwordReset: (name: string, url: string) =>
      build(
        'Reset your Secret Santa password',
        [
          `Hi ${name}!`,
          'Tap the button below to choose a new password. The link works once and expires in 24 hours.',
          "If you didn't ask for this, you can ignore this email. Your current password still works.",
        ],
        { label: 'Choose a new password', url },
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
    nudgeReveal: (name: string, group: string, url: string) =>
      build(
        `${group}: your match is waiting 🎁`,
        [`Hi ${name}!`, "Names were drawn, but you haven't unwrapped your match yet. Take a peek!"],
        { label: 'Reveal my match', url },
      ),
    invite: (organizer: string, group: string, url: string) =>
      build(
        `${organizer} invited you to Secret Santa: ${group} 🎅`,
        [
          'Hi!',
          `${organizer} is organizing a Secret Santa called "${group}" and would love you to join.`,
          'Tap the button, sign in with your account and you are in.',
        ],
        { label: 'Join the group', url },
      ),
    thankYou: (name: string, group: string, url: string) =>
      build(
        `${group}: your giftee says thank you 💌`,
        [`Hi ${name}!`, 'The person you gave a gift to sent you an anonymous thank-you note.'],
        { label: 'Read the note', url },
      ),
  },
  sl: {
    accountSetup: (name: string, email: string, url: string) =>
      build(
        'Tvoj račun za Skrivnega Božička je pripravljen 🎅',
        [
          `Živjo, ${name}!`,
          `Ustvarili smo ti račun. Prijavil/-a se boš z e-naslovom (${email}) in geslom.`,
          'Tapni gumb spodaj in si izberi geslo. Povezava deluje enkrat in poteče v 7 dneh.',
        ],
        { label: 'Nastavi geslo', url },
      ),
    passwordReset: (name: string, url: string) =>
      build(
        'Ponastavitev gesla za Skrivnega Božička',
        [
          `Živjo, ${name}!`,
          'Tapni gumb spodaj in si izberi novo geslo. Povezava deluje enkrat in poteče v 24 urah.',
          'Če tega nisi pričakoval/-a, lahko to sporočilo prezreš. Trenutno geslo še vedno deluje.',
        ],
        { label: 'Izberi novo geslo', url },
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
    nudgeReveal: (name: string, group: string, url: string) =>
      build(
        `${group}: tvoj obdarovanec te čaka 🎁`,
        [`Živjo, ${name}!`, 'Imena so izžrebana, ti pa še nisi odvil/-a svojega obdarovanca. Pokukaj!'],
        { label: 'Razkrij mojega obdarovanca', url },
      ),
    invite: (organizer: string, group: string, url: string) =>
      build(
        `${organizer} te vabi v Skrivnega Božička: ${group} 🎅`,
        [
          'Živjo!',
          `${organizer} organizira Skrivnega Božička »${group}« in bi bil/-a vesel/-a, če se pridružiš.`,
          'Tapni gumb, prijavi se s svojim računom in že si zraven.',
        ],
        { label: 'Pridruži se skupini', url },
      ),
    thankYou: (name: string, group: string, url: string) =>
      build(
        `${group}: tvoj obdarovanec se ti zahvaljuje 💌`,
        [`Živjo, ${name}!`, 'Oseba, ki si jo obdaril/-a, ti je poslala anonimno zahvalo.'],
        { label: 'Preberi zahvalo', url },
      ),
  },
} satisfies Record<Lang, unknown>;

/** Slovenian unless the user chose English. */
export const templates = (lang: string | null | undefined) => T[lang === 'en' ? 'en' : 'sl'];

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
    nudgeReveal: (group: string) => ({ title: `🎁 ${group}`, body: 'Your match is waiting. Tap to unwrap!' }),
    thankYou: (group: string) => ({ title: `💌 ${group}`, body: 'Your giftee sent you a thank-you note!' }),
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
    nudgeReveal: (group: string) => ({
      title: `🎁 ${group}`,
      body: 'Tvoj obdarovanec te čaka. Tapni in odvij!',
    }),
    thankYou: (group: string) => ({ title: `💌 ${group}`, body: 'Tvoj obdarovanec ti je poslal zahvalo!' }),
  },
};

export const pushText = (lang: string | null | undefined) => pushTexts[lang === 'en' ? 'en' : 'sl'];

export function formatDate(date: Date, lang: string | null | undefined): string {
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'sl-SI', { dateStyle: 'long' }).format(date);
}

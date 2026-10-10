# 🎅 Secret Santa

A friendly, installable Secret Santa app for families, friends and teams. Create a group in under a minute, share an invite link, set a few rules, and let the app draw names fairly — then everyone gets a private reveal, a wishlist with photos, and an anonymous chat with their Santa.

Built with **Angular** (installable PWA) and **Node.js**, hosted on **Render**, data in **MongoDB Atlas**, images on **Cloudinary**.

---

## ✨ Features

### For organizers
- **3-step group wizard** — name & date → budget & rules → invite people. No account setup marathon.
- **Invite by link or QR code** — share in WhatsApp, Slack, email or print it on a card.
- **Exclusion rules** — "Ana and Marko are a couple, don't pair them", plus an option to **avoid last year's pairs**.
- **Fair, constraint-aware draw** — nobody draws themselves, all exclusions respected, and the app warns *before* the draw if the rules make it impossible.
- **Organizer can play too** — pairings are hidden from the organizer by default, so they can join in without spoiling it.
- **Progress dashboard** — see who has joined, who has viewed their match, who has filled in a wishlist and who has marked their gift as bought, without seeing who drew whom.
- **Manage before and after the draw** — remove or add someone, re-draw safely, or reassign a single person who drops out without reshuffling everyone.
- **Reuse a group next year** — duplicate last year's group with one click.
- **Print mode** — printable reveal cards for in-person events.

### For participants
- **No password needed** — join with your name and email; sign back in with a magic link.
- **Animated reveal** — "unwrap" your match; reveal again any time.
- **Wishlist with photos** — add items with a title, link, price, notes and an uploaded image (photo of the exact mug, the size label, etc.).
- **"Please no" list** — things you don't want, sizes, favorite colors.
- **Anonymous chat** — ask your giftee questions without revealing who you are; they can reply.
- **Gift status** — mark "bought" and "delivered" so the organizer knows things are on track.
- **Optional shipping address** — for remote groups, shown only to your Santa.
- **Add to calendar** — download an `.ics` for the exchange day.
- **Gift photo wall** — after the exchange, everyone can upload photos of the unwrapping (and see who their Santa was, if the group enables the big reveal).

### Everywhere
- 📱 **Installable PWA** — works like a native app on Android, iOS and desktop; wishlist and match viewable offline.
- 🔔 **Reminders** — email and web push for "join", "draw done", "wishlist missing", "exchange in 3 days".
- 🌍 **English & Slovenian**, easy to add more languages.
- 🌙 **Dark mode**, large touch targets, keyboard and screen-reader friendly.
- 🔒 **Privacy first** — minimal data, group data auto-deleted N days after the event (configurable), "delete my data" button.

---

## 🧱 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Angular (standalone components, signals, zoneless), Angular Material 3, Transloco, `@angular/service-worker` | PWA support built in |
| Backend | Node.js (current LTS), Express, Mongoose, Zod validation | Simple, well-known |
| Database | MongoDB Atlas **Free (M0)** | Free forever, always on, no time limit |
| Images | Cloudinary **Free plan** (signed uploads) | Free CDN, resizing/thumbnails, no local disk needed |
| Email | Any SMTP / transactional provider with a free tier (e.g. Resend, Brevo) | Magic links and reminders |
| Push | Web Push (VAPID) via `web-push` | Free, no third party |
| Hosting | Render — **Static Site** (Angular) + **Web Service** (API) | Free tier, deploy from GitHub |

### Why these free tiers
- **MongoDB Atlas Free (M0)** is a permanently free shared cluster with 512 MB storage and no time limit — plenty for text data like groups, wishlists and messages. (Unlike some free Postgres tiers, it doesn't pause or scale to zero.)
- **Images don't go in MongoDB.** 512 MB would fill up fast, and Render's free web services have no persistent disk. Images go to Cloudinary; MongoDB stores only the URL and `public_id`. Cloudinary's free plan gives 25 credits per month, where 1 credit is roughly 1 GB storage *or* 1 GB bandwidth *or* 1,000 transformations. Images are resized in the browser before upload to stay well inside that.
- **Render free web services sleep after 15 minutes of inactivity** and take a little while to wake up. To keep this painless:
  - The Angular app is a **Render Static Site**, so the UI loads instantly even when the API is asleep.
  - The app shows a friendly *"Waking up the elves… 🎄"* loader while the API cold-starts.
  - Optionally, an external uptime pinger (UptimeRobot, cron-job.org) hits `/api/health` every ~14 minutes during the season.

---

## 📁 Project structure

```
secret-santa/
├── client/                     # Angular PWA
│   ├── src/app/
│   │   ├── core/               # API services, auth, interceptors (wake-up), i18n, theme
│   │   ├── features/           # landing, auth, join, create wizard, group, reveal,
│   │   │                       # wishlist, chat, dashboard (+ print), gallery, settings
│   │   └── shared/             # invite share/QR, exclusions editor, image picker, lightbox…
│   ├── public/i18n/            # en.json, sl.json (runtime translations)
│   ├── scripts/                # icon generator, i18n key check
│   └── ngsw-config.json        # offline caching of match + wishlists
├── server/                     # Node.js API (Express 5 + TypeScript + Mongoose + Zod)
│   ├── src/
│   │   ├── routes/             # auth, groups, invites, draw, wishlist, chat, extras, uploads, push
│   │   ├── models/             # User, Group, Membership, Assignment, WishlistItem, …
│   │   ├── services/           # draw algorithm, email, push, cloudinary, ics, notify
│   │   ├── middleware/         # auth, group membership, rate limits, validation, errors
│   │   ├── jobs/               # daily reminders + data retention (idempotent)
│   │   └── scripts/            # demo seed
│   └── test/                   # Vitest: draw algorithm + API integration (in-memory MongoDB)
├── .github/workflows/ci.yml    # lint, test, build both apps
├── render.yaml                 # Render Blueprint (static site + web service)
└── CLAUDE.md                   # notes for AI-assisted development
```

---

## 🚀 Getting started (local)

### Prerequisites
- Node.js 24 (current LTS) and npm
- That's it for a first run: without `MONGODB_URI` the API starts an **in-memory MongoDB**, without SMTP emails are **printed to the console**, and without Cloudinary/VAPID keys photo uploads and push are simply turned off.

### 1. Install
```bash
git clone https://github.com/<you>/secret-santa.git
cd secret-santa
npm run install:all          # root + server + client
cp server/.env.example server/.env
```

### 2. Run
```bash
npm run dev                  # API on http://localhost:3000 + app on http://localhost:4200
```
The Angular dev server proxies `/api` to the API (`client/proxy.conf.json`).

With the default `server/.env`:
- `SEED_DEMO=true` seeds a demo group **"Family Christmas"** with 6 people (Nika is the organizer; Ana, Marko, Eva, Luka, Maja), two "don't pair" rules and wishlists. Invite code `DEMOxmas`.
- `DEV_INSTANT_JOIN=true` adds **"Sign in instantly (dev)"** buttons, so you can sign in as e.g. `nika@example.com` or `ana@example.com` without email. (Ignored in production.)
- Magic links are logged to the API console *and* shown on screen.

### 3. Configure real services (optional locally, required in production)
Edit `server/.env` (see `server/.env.example` for every option):

| Variable | What it's for |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string. Empty → in-memory DB (dev only). |
| `JWT_SECRET` | Long random string for session cookies. |
| `CLIENT_URL` | URL of the web app (CORS + links in emails). |
| `CLOUDINARY_*` | Photo uploads (signed, direct from the browser). |
| `SMTP_*`, `MAIL_FROM` | Magic links and reminders. Empty → logged to the console. |
| `VAPID_*` | Web Push. Generate with `npx web-push generate-vapid-keys`. |
| `DATA_RETENTION_DAYS` | Delete group data this many days after the exchange (default 60). |
| `DAILY_JOB_CRON` | When the reminder/cleanup job runs (UTC, default `0 8 * * *`). |

To seed the demo group into a real database: `npm run seed` (uses `MONGODB_URI`).

### 4. Test, lint, build
```bash
npm test                     # server (draw algorithm + API) and client
npm run lint                 # ESLint + Prettier (+ i18n key parity for the client)
npm run build
```
Push notifications and offline mode need the service worker, which only runs in a production build. To try it locally (with the API running on :3000):
```bash
npm run build --prefix client
npx http-server client/dist/client/browser -p 8080 -P http://localhost:3000   # unknown paths, incl. /api, go to the API
```
Then open http://localhost:8080 (set `CLIENT_URL=http://localhost:8080` in `server/.env` so email links match).

---

## ☁️ Deploying to Render

1. **MongoDB Atlas**: create a free M0 cluster, a database user, and under **Network Access** allow `0.0.0.0/0` (Render free services have no fixed IPs; use a strong password). Copy the `mongodb+srv://…` URI.
2. **Cloudinary** (optional): copy cloud name, API key and API secret from the dashboard.
3. **SMTP** (optional but needed for real sign-ins): any provider with a free tier (Resend, Brevo, Mailjet…). Verify your sender domain/address.
4. **VAPID** (optional): `npx web-push generate-vapid-keys`.
5. Push this repo to GitHub, then in Render choose **New → Blueprint** and select it. `render.yaml` creates:
   - `secret-santa-api`: Web Service (`server/`, health check `/api/health`)
   - `secret-santa-web`: Static Site (`client/`) that **proxies `/api/*` to the API** and falls back to `index.html` for deep links
6. Fill in the env vars Render asks for (`MONGODB_URI`, `CLIENT_URL` = the static site URL, Cloudinary/SMTP/VAPID).
7. If Render gave the API a different hostname than `secret-santa-api.onrender.com`, update the `/api/*` rewrite destination in `render.yaml` (or in the static site's **Redirects/Rewrites** settings).

**Why the proxy?** `*.onrender.com` is a public suffix, so a static site and an API on two Render subdomains are *different sites*. Browsers (Safari in particular) block third-party cookies. Proxying `/api` through the static site keeps the session cookie first-party. If you host the API elsewhere, set `apiUrl` in `client/src/environments/environment.ts` and `COOKIE_SAMESITE=none` on the API.

**Cold starts:** free web services sleep after ~15 minutes. The app shows *"Waking up the elves… 🎄"* and retries automatically. Optionally point an uptime pinger (UptimeRobot, cron-job.org) at `https://<api>/api/health` every ~14 minutes during the season. The daily job also runs ~10 s after every start, and reminders are idempotent, so nothing is missed or sent twice after a nap.

---

## 🎲 How the draw works

1. Participants and exclusion rules form a bipartite graph of allowed "gives to" edges (rules are symmetric; nobody gives to themselves; last year's pairs are excluded when the group was duplicated).
2. **Feasibility first:** a maximum matching decides exactly whether a valid draw exists. If not, Hall's theorem pinpoints the people who are over-constrained, and the organizer sees e.g. *"Too many rules: Ana, Bo and Cy can only give to 2 people between them. Remove a rule for one of them."*
3. **Draw:** randomized backtracking (most-constrained person first, with forward checking), with a randomized augmenting-path fallback that always finishes.
4. **Drop-outs and late joiners** are handled with minimal changes: first only the affected Santa is reconnected, then 1, 2 or 3 others, and only as a last resort a full redraw. Everyone whose match changed is notified.
5. Results are stored per participant; the API only ever returns *your own* match.

The algorithm lives in `server/src/services/draw.ts` (pure functions with a seedable RNG) and is covered by tests for 2–30 participants, heavy exclusions, impossible cases, 1,000 random runs and a brute-force cross-check.

---

## 🔒 Security & privacy

- Magic-link tokens are single-use, short-lived and stored hashed.
- Each participant can only read their own match, and only their own match's wishlist.
- Rate limiting on auth, upload and chat endpoints, `helmet`, strict CORS, Zod validation on every input.
- Uploads: signed Cloudinary uploads, image types only, size limit, EXIF location stripped.
- Automatic deletion of groups, messages and images `DATA_RETENTION_DAYS` after the exchange date, plus a "Delete my data" button in Settings.
- The anonymous chat never sends user ids or thread keys to the browser; the organizer can't see pairs unless they opt in (or aren't playing).

---

## 🗺️ Roadmap
- [ ] Multiple gift rounds in one group (e.g. kids and adults)
- [ ] Wishlist item reservations for shared/group gifts
- [ ] Import participants from CSV
- [ ] More languages

## 🤝 Contributing
Issues and pull requests are welcome. Please run the tests and linter before opening a PR.

## 📄 License
MIT
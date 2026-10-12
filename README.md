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
- **Gift themes** — e.g. "Made in Slovenia", handmade, experiences, books, eco, sweets or your own rule.
- **Invite by email** and a one-tap **nudge** for people who haven't unwrapped their match or filled their wishlist.

### For participants
- **Simple accounts** — the admin registers you with a username and email; you choose your password from the emailed link and sign in with email + password. Change it any time in Settings.
- **Animated reveal** — "unwrap" your match; reveal again any time.
- **Wishlist with photos** — add items with a title, link, price, notes and an uploaded image (photo of the exact mug, the size label, etc.).
- **"Please no" list** — things you don't want, sizes, favorite colors.
- **Anonymous chat** — ask your giftee questions without revealing who you are; they can reply.
- **Gift status** — mark "bought" and "delivered" so the organizer knows things are on track.
- **Optional shipping address** — for remote groups, shown only to your Santa.
- **Add to calendar** — download an `.ics` for the exchange day.
- **Gift photo wall** — after the exchange, everyone can upload photos of the unwrapping (and see who their Santa was, if the group enables the big reveal).
- **Paste a shop link** — the wish fills itself in (title, price and photo from the shop page).
- **Gift ideas** — budget- and theme-aware suggestions when your giftee's wishlist is empty.
- **Unread badges** — see at a glance when your Santa or giftee wrote to you.
- **Anonymous thank-you** — after the exchange, thank your Santa without the big reveal.

### Everywhere
- 📱 **Installable PWA** — works like a native app on Android, iOS and desktop; wishlist and match viewable offline. Right after joining, the app offers notifications and installation (with Add to Home Screen steps on iPhone).
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
| Email | Any SMTP / transactional provider with a free tier (e.g. Resend, Brevo) | Account setup / password reset links and reminders |
| Push | Web Push (VAPID) via `web-push` | Free, no third party |
| Hosting | Render — **one free Web Service** (Express serves the API *and* the Angular app) | Free tier, deploy from GitHub |

### Why these free tiers
- **MongoDB Atlas Free (M0)** is a permanently free shared cluster with 512 MB storage and no time limit — plenty for text data like groups, wishlists and messages. (Unlike some free Postgres tiers, it doesn't pause or scale to zero.)
- **Images don't go in MongoDB.** 512 MB would fill up fast, and Render's free web services have no persistent disk. Images go to Cloudinary; MongoDB stores only the URL and `public_id`. Cloudinary's free plan gives 25 credits per month, where 1 credit is roughly 1 GB storage *or* 1 GB bandwidth *or* 1,000 transformations. Images are resized in the browser before upload to stay well inside that.
- **Render free web services sleep after 15 minutes of inactivity**, and free services share **750 instance-hours per month** per workspace. So everything runs as **one** web service, which fits 24/7 (a month has at most 744 hours):
  - The server **pings itself** every 10 minutes so it never falls asleep (≈2 MB of traffic a month).
  - If it ever does sleep, installed users still get the UI instantly from the service worker cache, and the app shows a friendly *"Waking up the elves… 🎄"* loader while the API wakes up.
- **Render's free bandwidth (100 GB/month)** goes a long way: images are served by Cloudinary, not Render; responses are gzipped; hashed app bundles are cached by browsers for a year; returning visitors load the app from the service worker; chat polling slows down from 12 s to 60 s when nobody is writing. A first visit costs roughly 0.2 MB.

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
├── e2e/                        # Playwright end-to-end tests (real API + production build)
├── .github/workflows/ci.yml    # lint, test, build both apps + e2e
├── render.yaml                 # Render Blueprint (one web service: API + app)
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
- Account setup and reset links are logged to the API console *and* shown on screen (on the register page, the admin user list and the first-time admin setup).

### 3. Configure real services (optional locally, required in production)
Edit `server/.env` (see `server/.env.example` for every option):

| Variable | What it's for |
|---|---|
| `MONGODB_URI` | MongoDB Atlas connection string. Empty → in-memory DB (dev only). |
| `JWT_SECRET` | Long random string for session cookies. |
| `CLIENT_URL` | URL of the web app (CORS + links in emails). |
| `CLOUDINARY_*` | Photo uploads (signed, direct from the browser). |
| `BREVO_API_KEY` *or* `RESEND_API_KEY` *or* `SMTP_*`, plus `MAIL_FROM` | Account setup / password reset links and reminders. Use an HTTPS API key (Brevo/Resend) on Render: free instances block outbound SMTP ports. None set → logged to the console. |
| `VAPID_*` | Web Push. Generate with `npx web-push generate-vapid-keys`. |
| `DATA_RETENTION_DAYS` | Delete group data this many days after the exchange (default 60). |
| `DAILY_JOB_CRON` | When the reminder/cleanup job runs (UTC, default `0 8 * * *`). |

To seed the demo group into a real database: `npm run seed` (uses `MONGODB_URI`).

### 4. Test, lint, build
```bash
npm test                     # server (draw algorithm + API) and client
npm run test:e2e             # Playwright: accounts + create → join → draw → reveal → chat (first: npx --prefix e2e playwright install chromium)
npm run lint                 # ESLint + Prettier (+ i18n key parity for the client)
npm run build
```
Push notifications and offline mode need the service worker, which only runs in a production build. To try the production setup locally (one server for app + API, like on Render):
```bash
npm run build --prefix client
npm run dev --prefix server      # now also serves the built app on http://localhost:3000
```
Set `CLIENT_URL=http://localhost:3000` in `server/.env` so email links match.

---

## ☁️ Deploying to Render

1. **MongoDB Atlas**: create a free M0 cluster, a database user, and under **Network Access** allow `0.0.0.0/0` (Render free services have no fixed IPs; use a strong password). Copy the `mongodb+srv://…` URI.
2. **Cloudinary** (optional): copy cloud name, API key and API secret from the dashboard.
3. **Email** (needed for real sign-ins): Render's free tier **blocks outbound SMTP**, so use an HTTPS email API. Easiest: **Brevo** (free, 300/day). Verify your sender address under *Senders, Domains & Dedicated IPs*, create an API key under *SMTP & API → API Keys*, and set `BREVO_API_KEY` + `MAIL_FROM="Secret Santa <you@example.com>"`. Alternatively **Resend** (`RESEND_API_KEY`, needs your own verified domain).
4. **VAPID** (optional): `npx web-push generate-vapid-keys`.
5. Push this repo to GitHub, then in Render choose **New → Blueprint** and select it. `render.yaml` creates **one free Web Service** named `nik-secret-santa` (https://nik-secret-santa.onrender.com). It builds both apps, and Express serves the API under `/api` plus the Angular app for everything else.
6. Fill in the env vars Render asks for (`MONGODB_URI`, Cloudinary, `BREVO_API_KEY`/`RESEND_API_KEY` + `MAIL_FROM`, VAPID). `CLIENT_URL` is preset to `https://nik-secret-santa.onrender.com`. If Render assigned a different URL (it adds a suffix when a name is taken), change `CLIENT_URL` to match.
7. Keep this the **only free web service** in your Render workspace, so the 750 free instance-hours cover running 24/7.
8. **First admin sign-in:** on the sign-in page, type an address listed in `ADMIN_EMAILS` (preset to the owner in `render.yaml`) and tap **"Admin signing in for the first time? Email me a setup link"**. This only works while that admin has no password yet.
9. **Admin page** (**Settings → Health & free-tier limits**, `/admin`): the **Users** list with a **Reset password** button per person (or **Send link** for people who never set a password), a **Register** button (`/admin/register`: username + email → the person gets a link to choose their password), plus MongoDB size, email sends per day, Cloudinary credits, memory and the daily job.
10. **Moving from magic links:** existing accounts keep their groups but have no password. Send each person a setup link from the Users list once.

**Always on:** the server pings its own public URL (`RENDER_EXTERNAL_URL`, set by Render) every 10 minutes, so it never reaches the 15-minute idle sleep. As a backup, add a free [UptimeRobot](https://uptimerobot.com) HTTP monitor on `https://nik-secret-santa.onrender.com/api/health` every 5–10 minutes. It also wakes the service if a restart ever leaves it asleep. To disable the self-ping, set `KEEP_ALIVE_URL=off`.

**One origin:** because the app and API share a URL, the session cookie is first-party (`SameSite=Lax`), which works in every browser including Safari. If you ever host the API elsewhere, set `apiUrl` in `client/src/environments/environment.ts` and `COOKIE_SAMESITE=none` on the API.

**After a nap or restart:** the daily job runs ~10 s after every start, and reminders are idempotent, so nothing is missed or sent twice.

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

- Accounts are created only by admins. Passwords are hashed with scrypt (salted). Setup/reset links are single-use, expire (7 days / 24 hours), are stored hashed, and only the newest link per user works.
- Changing or resetting a password signs out all other sessions. Login errors don't reveal whether an email has an account.
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
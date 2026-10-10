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
| Frontend | Angular (standalone components, signals), Angular Material or Tailwind, `@angular/service-worker` | PWA support built in |
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
├── client/                 # Angular PWA
│   ├── src/app/
│   │   ├── core/           # services, interceptors, guards
│   │   ├── features/       # group, join, reveal, wishlist, chat, dashboard
│   │   └── shared/         # UI components, pipes
│   └── ngsw-config.json
├── server/                 # Node.js API
│   ├── src/
│   │   ├── routes/
│   │   ├── models/
│   │   ├── services/       # draw algorithm, email, push, cloudinary
│   │   ├── middleware/
│   │   └── jobs/           # reminders, data retention cleanup
│   └── test/
├── render.yaml             # Render Blueprint (static site + web service)
└── README.md
```

---

## 🚀 Getting started (local)

### Prerequisites
- Node.js (current LTS) and npm
- A free MongoDB Atlas cluster (or local MongoDB / Docker)
- A free Cloudinary account

### 1. Clone and install
```bash
git clone https://github.com/<you>/secret-santa.git
cd secret-santa
npm install --prefix server
npm install --prefix client
```

### 2. Configure the API
Create `server/.env`:
```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/secret-santa
JWT_SECRET=change-me
CLIENT_URL=http://localhost:4200

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Secret Santa <santa@example.com>"

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com

DATA_RETENTION_DAYS=60
```
Generate VAPID keys with `npx web-push generate-vapid-keys`.

> Without SMTP settings, magic links are printed to the server console — handy for development.

### 3. Run
```bash
npm run dev --prefix server     # API on http://localhost:3000
npm start --prefix client       # App on http://localhost:4200
```

### 4. Test
```bash
npm test --prefix server        # includes draw-algorithm tests
npm test --prefix client
```

---

## ☁️ Deploying to Render

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and select the repo — `render.yaml` creates:
   - `secret-santa-api` — Web Service (`server/`)
   - `secret-santa-web` — Static Site (`client/`, with SPA rewrite to `index.html`)
3. Fill in the environment variables in the Render dashboard.
4. In MongoDB Atlas → **Network Access**, allow connections from Render (Render's outbound IPs, or `0.0.0.0/0` with a strong password).
5. Set `CLIENT_URL` on the API to the static site URL and `apiUrl` in the Angular production environment to the API URL.

---

## 🎲 How the draw works

1. Participants and exclusion rules form a graph of allowed "gives to" edges.
2. A randomized backtracking search finds a single cycle-free-of-conflicts assignment where each person gives exactly once and receives exactly once.
3. If no valid assignment exists, the organizer gets a clear message ("Too many exclusions for Ana — remove one rule") instead of a failed draw.
4. Results are stored per participant; the API only ever returns *your own* match.

---

## 🔒 Security & privacy

- Magic-link tokens are single-use, short-lived and stored hashed.
- Each participant can only read their own match, and only their own match's wishlist.
- Rate limiting on auth and upload endpoints, `helmet`, strict CORS.
- Uploads: signed Cloudinary uploads, image types only, size limit, EXIF location stripped.
- Automatic deletion of groups, messages and images `DATA_RETENTION_DAYS` after the exchange date.

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
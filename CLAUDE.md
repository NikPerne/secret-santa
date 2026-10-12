# CLAUDE.md

Notes for Claude Code working in this repo. README.md is the product spec and user docs, so read it for features and setup.

## Layout
- `client/`: Angular 22 PWA (standalone components, signals, zoneless, OnPush, Angular Material 3, SCSS, Transloco, `@angular/service-worker`). Tests use Vitest through `ng test`.
- `server/`: Express 5 + TypeScript (ESM, `NodeNext`, so relative imports end in `.js`), Mongoose 9, Zod 4, Vitest + supertest + mongodb-memory-server.
- Root `package.json`: convenience scripts only (`npm run dev` runs both with concurrently). Each app has its own lockfile; Render builds both inside one service.
- `render.yaml`: Render Blueprint with ONE free web service (Express serves `/api` and the built Angular app via `server/src/static.ts`). Don't add a second free service: 750 instance-hours/month only covers one running 24/7. `.github/workflows/ci.yml`: lint, test, build for both apps.

## Environment gotchas (Windows dev machine)
- Node lives at `C:\Program Files\nodejs` and is often missing from the Bash tool's PATH. Prefix commands with `export PATH="/c/Program Files/nodejs:$PATH";`.
- Large bash heredocs and `node -e "..."` with backticks are risky: backticks inside double quotes run as command substitution (this once launched a server and corrupted README). Use the Write tool, or a script file in the scratchpad.
- Dev servers started with `timeout N npx ...` can outlive the timeout. Free the ports with PowerShell `Get-NetTCPConnection -LocalPort 3000 ... | Stop-Process`.
- npm 11 install-script gating: esbuild/mongodb-memory-server postinstalls aren't approved. That's fine: the memory server downloads its binary on first use.

## Commands
```bash
npm run dev                  # root: API :3000 + Angular :4200 (proxy /api -> :3000)
cd server && npm test        # Vitest: draw algorithm + API integration (in-memory Mongo)
cd server && npm run lint    # eslint + prettier --check   (fix: npx prettier --write .)
cd server && npm run seed    # demo group into MONGODB_URI (in-memory DB: SEED_DEMO=true instead)
cd client && npm test        # ng test (Vitest), non-watch
cd client && npm run lint    # ng lint + i18n key parity + prettier --check   (fix: npm run format)
cd client && npm run build   # production build incl. service worker -> dist/client/browser
npm run test:e2e             # root: builds client, Playwright runs the API (in-memory DB) serving it on :3100
```

## Key decisions
- **Single service, same origin.** The client calls a relative `/api` (`environment.apiUrl = ''`). Dev uses the Angular dev server + `client/proxy.conf.json`. In prod, Express serves `client/dist/client/browser` (`serveClient`: hashed bundles cached 1 year, index/ngsw no-cache, SPA fallback for extension-less paths, gzip via `compression`). The cookie is first-party (`SameSite=Lax`). The CSP lives in `app.ts`: keep Angular's `inlineCritical: false`, because its inline `onload` would be blocked.
- **Free-tier budget.** `jobs/keep-alive.ts` pings `RENDER_EXTERNAL_URL/api/health` every 10 min in production (`KEEP_ALIVE_URL=off` disables). Bandwidth (100 GB/month) is protected by gzip, long-lived caching, the service worker, Cloudinary-hosted images and adaptive chat polling (12→60 s). Keep new polling/background traffic small.
- **No MONGODB_URI in dev/test** means mongodb-memory-server (`server/src/db.ts`). With `SEED_DEMO=true` the demo group is seeded on start. Production requires the URI.
- **Auth:** email + password (`POST /api/auth/login`, scrypt hashes in `services/password.ts`, `User.passwordHash` is `select: false`) → JWT in the httpOnly cookie `ss_session` carrying `User.sessionVersion` (`v`); bumping it on password set/change signs out other sessions. Only admins create accounts (`POST /api/admin/users`); the user gets a `PasswordToken` link (`purpose` setup 7 d / reset 24 h, sha256 hash, TTL index, single use via atomic `findOneAndUpdate`, newer link deletes older ones; `services/password-links.ts`) to `/auth/set-password`. `POST /api/auth/admin-setup` bootstraps `ADMIN_EMAILS` that have no password yet. There's no public sign-up or self-service "forgot password" (keeps email volume low). `DEV_INSTANT_JOIN=true` (ignored in production) enables `POST /api/auth/dev-login`, which still creates users on the fly (tests and e2e rely on it). Email providers (`services/email.ts`): `BREVO_API_KEY` / `RESEND_API_KEY` over HTTPS (required on Render free, which blocks outbound SMTP ports), else SMTP, else console + `devOutbox` (used by tests), in which case link-sending endpoints return `devLink`. All sends time out after 15s and never throw.
- **Routing/authorization:** `app.ts` mounts `/api/groups/:groupId` → `requireAuth` → `loadGroupMembership` (404 for non-members) → feature routers (`groups`, `draw`, `wishlist`, `chat`, `extras`). Use `groupCtx(req)` in handlers. A participant may only read their own assignment and their receiver's wishlist/preferences. Never return `giverId`/`threadKey` to a receiver. Chat responses expose only `mine` + text.
- **Organizer sees pairs** only if `settings.organizerSeesPairs` or they aren't participating (`organizerCanSeePairs` in `routes/draw.ts`). Print cards use the same rule.
- **Draw** (`server/src/services/draw.ts`) is pure: `checkFeasibility` (bipartite matching + Hall's theorem for readable reasons), `draw` (MRV randomized backtracking with step cap, randomized augmenting-path fallback), `reassign`/`insertParticipant` (minimal-change repair: 0 → 3 released givers, then full redraw). `mulberry32` gives a seeded RNG. Persistence and side effects live in `draw-runner.ts` (late joiners hook in via `onJoinAfterDraw` to avoid an import cycle).
- **Exchange dates** are calendar days stored at 12:00 UTC (client sends `YYYY-MM-DD` via `toYmd`). This keeps the `.ics` and other timezones on the right day.
- **Images:** only Cloudinary `url` + `publicId` go in Mongo. The server signs uploads into `${CLOUDINARY_FOLDER}/${groupId}/${purpose}` and `isOwnedImage` validates saved refs. The client resizes to 1600px WebP/JPEG 0.8 (`compressImage`). Group deletion also deletes the folder by prefix.
- **Notifications:** `services/notify.ts` (email respects `emailNotifications`, push via `web-push` in Angular-SW payload format). Jobs (`jobs/daily.ts`) run ~10s after start and on `DAILY_JOB_CRON`. They're idempotent via unique keys in `NotificationLog` (`claimNotification`). Chat push is throttled to one per thread direction per 10 min.
- **i18n:** `client/public/i18n/{en,sl}.json` must have identical keys (lint enforces this). API error codes map to `errors.<code>` keys (`NotifyService`). Server emails and push texts have their own en/sl strings in `server/src/services/email-templates.ts`.
- **Wake-up UX:** `core/interceptors.ts` shows the elves overlay after 2s and retries 502/503/504 (and network errors on GET). Pass `context: new HttpContext().set(BACKGROUND, true)` for silent background polls.

- **Engagement features:** unread badges use `Membership.chatReadAt` (`services/unread.ts`); nudges/thank-you/invite emails go through `notify.ts` + `claimNotification` keys (`nudge:<g>:<u>:<day>`, `thanks:<assignmentId>`); thank-you notes live on `Assignment.thankYou` so they never reveal the Santa.
- **Group theme + gift ideas:** `Group.theme {preset, text}`; curated bilingual ideas with EUR prices in `client/.../wishlist/gift-ideas.data.ts` (`suggestIdeas` filters by budget).
- **Link previews:** `services/link-preview.ts` is SSRF-hardened (connect-time IP check via custom `lookup`, http(s) default ports, 3 redirects, 1 MB, 8 s, in-memory cache). Cloudinary imports the og:image itself (`importRemoteImage`), so images never pass through Render.
- **Admin:** `ADMIN_EMAILS` → `user.isAdmin`; `/api/admin/*` (enforced server-side; client `adminGuard`): `health`, `users` (list, register), `users/:id/password-link` (rate-limited by `adminMailLimiter`). Daily counters in `SystemStat` (`bumpDaily('mail')`, `job:daily`), auto-expiring.
- **E2E:** `e2e/` (own lockfile). Tests force English via `localStorage['ss.lang']='en'` and dismiss the engage card; selectors use visible English labels, so update them when changing `en.json`.

## Conventions
- Validate every request body/query/params with Zod via `parse(schema, input)` from `middleware/validate.ts`. Throw helpers from `utils/http-error.ts`, and the error handler turns them into `{ error: { code, message } }`.
- Client: one folder per feature under `features/`, HTTP in `core/api/*.service.ts`, types in `core/models.ts`. Use signals, `@if/@for`, `inject()`, and every user-visible string through Transloco (add keys to both language files).
- Tests: put API tests in `server/test/*.test.ts` using `useDatabase()` + `signIn()` / `createGroupWith()` from `test/helpers.ts`. Mongoose won't update `createdAt`, so backdate via `Model.collection.updateMany`.
- Commit after each logical step. Never commit `.env`.

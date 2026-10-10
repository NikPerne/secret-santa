# CLAUDE.md

Notes for Claude Code working in this repo. README.md is the product spec and user docs, so read it for features and setup.

## Layout
- `client/`: Angular 22 PWA (standalone components, signals, zoneless, OnPush, Angular Material 3, SCSS, Transloco, `@angular/service-worker`). Tests use Vitest through `ng test`.
- `server/`: Express 5 + TypeScript (ESM, `NodeNext`, so relative imports end in `.js`), Mongoose 9, Zod 4, Vitest + supertest + mongodb-memory-server.
- Root `package.json`: convenience scripts only (`npm run dev` runs both with concurrently). Each app has its own lockfile because Render builds them separately.
- `render.yaml`: Render Blueprint (static site + web service). `.github/workflows/ci.yml`: lint, test, build for both apps.

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
```

## Key decisions
- **Same-origin API.** The client calls a relative `/api` (`environment.apiUrl = ''`). Dev uses `client/proxy.conf.json`; prod uses a Render static-site rewrite `/api/*` to the API. This keeps the JWT cookie first-party (`SameSite=Lax`), because `*.onrender.com` is a public suffix and Safari blocks third-party cookies. The fallback is `COOKIE_SAMESITE=none` + `apiUrl`.
- **No MONGODB_URI in dev/test** means mongodb-memory-server (`server/src/db.ts`). With `SEED_DEMO=true` the demo group is seeded on start. Production requires the URI.
- **Auth:** magic link → `LoginToken` (sha256 hash, 15 min TTL index, single use via atomic `findOneAndUpdate`) → JWT in the httpOnly cookie `ss_session`. `DEV_INSTANT_JOIN=true` (ignored in production) enables `POST /api/auth/dev-login`. Without SMTP, emails go to the console and `devOutbox` (used by tests), and `request-link` returns `devLink`.
- **Routing/authorization:** `app.ts` mounts `/api/groups/:groupId` → `requireAuth` → `loadGroupMembership` (404 for non-members) → feature routers (`groups`, `draw`, `wishlist`, `chat`, `extras`). Use `groupCtx(req)` in handlers. A participant may only read their own assignment and their receiver's wishlist/preferences. Never return `giverId`/`threadKey` to a receiver. Chat responses expose only `mine` + text.
- **Organizer sees pairs** only if `settings.organizerSeesPairs` or they aren't participating (`organizerCanSeePairs` in `routes/draw.ts`). Print cards use the same rule.
- **Draw** (`server/src/services/draw.ts`) is pure: `checkFeasibility` (bipartite matching + Hall's theorem for readable reasons), `draw` (MRV randomized backtracking with step cap, randomized augmenting-path fallback), `reassign`/`insertParticipant` (minimal-change repair: 0 → 3 released givers, then full redraw). `mulberry32` gives a seeded RNG. Persistence and side effects live in `draw-runner.ts` (late joiners hook in via `onJoinAfterDraw` to avoid an import cycle).
- **Exchange dates** are calendar days stored at 12:00 UTC (client sends `YYYY-MM-DD` via `toYmd`). This keeps the `.ics` and other timezones on the right day.
- **Images:** only Cloudinary `url` + `publicId` go in Mongo. The server signs uploads into `${CLOUDINARY_FOLDER}/${groupId}/${purpose}` and `isOwnedImage` validates saved refs. The client resizes to 1600px WebP/JPEG 0.8 (`compressImage`). Group deletion also deletes the folder by prefix.
- **Notifications:** `services/notify.ts` (email respects `emailNotifications`, push via `web-push` in Angular-SW payload format). Jobs (`jobs/daily.ts`) run ~10s after start and on `DAILY_JOB_CRON`. They're idempotent via unique keys in `NotificationLog` (`claimNotification`). Chat push is throttled to one per thread direction per 10 min.
- **i18n:** `client/public/i18n/{en,sl}.json` must have identical keys (lint enforces this). API error codes map to `errors.<code>` keys (`NotifyService`). Server emails and push texts have their own en/sl strings in `server/src/services/email-templates.ts`.
- **Wake-up UX:** `core/interceptors.ts` shows the elves overlay after 2s and retries 502/503/504 (and network errors on GET). Pass `context: new HttpContext().set(BACKGROUND, true)` for silent background polls.

## Conventions
- Validate every request body/query/params with Zod via `parse(schema, input)` from `middleware/validate.ts`. Throw helpers from `utils/http-error.ts`, and the error handler turns them into `{ error: { code, message } }`.
- Client: one folder per feature under `features/`, HTTP in `core/api/*.service.ts`, types in `core/models.ts`. Use signals, `@if/@for`, `inject()`, and every user-visible string through Transloco (add keys to both language files).
- Tests: put API tests in `server/test/*.test.ts` using `useDatabase()` + `signIn()` / `createGroupWith()` from `test/helpers.ts`. Mongoose won't update `createdAt`, so backdate via `Model.collection.updateMany`.
- Commit after each logical step. Never commit `.env`.

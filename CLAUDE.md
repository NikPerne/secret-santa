# CLAUDE.md

Notes for Claude Code working in this repo. README.md is the product spec, so read it for features.

## Layout
- `client/`: Angular 22 PWA (standalone components, signals, zoneless, OnPush, Angular Material 3, SCSS, Transloco, `@angular/service-worker`). Tests use Vitest through `ng test`.
- `server/`: Express 5 + TypeScript (ESM, `NodeNext`, so imports end in `.js`), Mongoose 9, Zod 4, Vitest + supertest + mongodb-memory-server.
- Root `package.json`: convenience scripts only (`npm run dev` runs both apps with concurrently). Each app has its own lockfile because Render builds them separately.
- `render.yaml`: Render Blueprint (static site + web service). `.github/workflows/ci.yml`: lint, test, build.

## Environment (Windows dev machine)
- Node is installed at `C:\Program Files\nodejs` but may be missing from the Bash tool's PATH. Prefix with `export PATH="/c/Program Files/nodejs:$PATH";`.
- Large bash heredocs with many quotes have failed to parse. Prefer the Write tool for files.
- npm 11 install-script gating: esbuild/mongodb-memory-server postinstalls are not approved. That's fine: the memory server downloads its binary on first use.

## Commands
```bash
npm run dev                 # root: API :3000 + Angular :4200 (proxy /api -> :3000)
cd server && npm test       # Vitest (draw algorithm + API integration on in-memory Mongo)
cd server && npm run lint   # eslint + prettier --check
cd server && npm run seed   # demo group (needs MONGODB_URI, or prints against in-memory DB)
cd client && npm test       # ng test (Vitest), non-watch
cd client && npm run lint   # ng lint + i18n key parity check + prettier --check
cd client && npm run build  # production build incl. service worker -> dist/client/browser
```
Run `npx prettier --write .` (server) or `npm run format` (client) before linting.

## Key decisions
- **Same-origin API.** The client calls a relative `/api` (`environment.apiUrl = ''`). Dev uses `client/proxy.conf.json`; prod uses a Render static-site rewrite `/api/*` to the API service. This keeps the JWT cookie first-party (`SameSite=Lax`), because `*.onrender.com` is a public suffix and Safari blocks third-party cookies. `COOKIE_SAMESITE=none` plus `apiUrl` is the fallback if a cross-site API is needed.
- **No MONGODB_URI in dev/test** means the server starts mongodb-memory-server (`server/src/db.ts`). Production requires the URI.
- **Auth:** magic link → `LoginToken` (sha256 hash, 15 min TTL, single use via atomic `findOneAndUpdate`) → JWT in an httpOnly cookie `ss_session`. `DEV_INSTANT_JOIN=true` (ignored in production) enables `/api/auth/dev-login`. Without SMTP, emails are logged to the console.
- **Authorization:** every group route loads the caller's `Membership` (`middleware/group.ts`). A participant may only read their own assignment and their receiver's wishlist/preferences. Never return `giverId` to a receiver. Chat responses expose only `fromRole` + a `mine` flag.
- **Draw** (`server/src/services/draw.ts`) is pure: `checkFeasibility` (bipartite matching + Hall's theorem for human-readable reasons), `draw` (MRV randomized backtracking with step cap, then randomized augmenting-path fallback), `reassign` (minimal-change replacement when someone drops out). Seeded RNG `mulberry32` for tests. Previous-year pairs are a hard constraint in `draw`. The route retries without them if infeasible.
- **Images:** only Cloudinary `url` + `publicId` in Mongo. Server signs uploads into `${CLOUDINARY_FOLDER}/${groupId}/...` and validates that saved publicIds sit under that prefix. The client resizes to max 1600px (WebP/JPEG 0.8) before upload.
- **Jobs** (`server/src/jobs/daily.ts`) run on startup and daily via node-cron. They are idempotent through unique keys in `NotificationLog`, so a cold-started server catches up safely.
- **i18n:** `client/public/i18n/{en,sl}.json`. Keys must stay in sync (`scripts/check-i18n.mjs` enforces this in lint). Server emails have their own small en/sl strings in `server/src/services/email-templates.ts`.
- **Wake-up UX:** `core/interceptors.ts` shows the elves overlay after 2s and retries 502/503/504 (and network errors on GET).

## Conventions
- Validate every request body/query/params with Zod (`validate()` helper). Throw `HttpError` helpers from `utils/http-error.ts`.
- Client: one folder per feature under `features/`, API calls in `core/api/*.service.ts`, typed models in `core/models.ts`. Use signals, `@if/@for`, `inject()`, and every user-visible string through Transloco.
- Commit after each logical phase. Don't commit `.env`.

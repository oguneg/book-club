# Architecture

Decisions from the kickoff interview (2026-10-08). Product scope is in [PRODUCT.md](../PRODUCT.md); build order in [PLAN.md](PLAN.md).

## Overview

```
 iOS / Android app (Expo)        web app (same code, react-native-web)
            │  HTTPS + WebSocket            │
            └──────────────┬────────────────┘
                           ▼
        bookclub.ogun.se  (shared Caddy proxy on the VPS, HTTPS)
                           │
              ┌────────────▼─────────────┐
              │ app container (Node 22)  │  /api/*  REST (Hono)
              │                          │  /api/auth/*  Better Auth
              │                          │  /api/ws  live updates
              │                          │  /*  static web build
              └────────────┬─────────────┘
                           │ (private network)
              ┌────────────▼─────────────┐      nightly pg_dump, encrypted
              │ Postgres 17 container    │ ───▶ off-site object storage
              └──────────────────────────┘
   outbound: Google Books, Open Library, Expo push service, Apple/Google auth
```

One origin serves the web app and the API, so the web app uses cookies with no CORS. Mobile apps call the same `https://bookclub.ogun.se/api` with a bearer session token kept in the device's secure storage. **That address is permanent:** shipped apps call it forever.

## Repository layout (npm workspaces)

```
apps/mobile      Expo app (iOS, Android, web), Expo Router
apps/server      Hono API, Better Auth, Drizzle, WebSocket hub, jobs
packages/shared  zod schemas and API types, position math, constants (limits, reaction set)
docs/            architecture, plan, runbooks (deploy, restore, secrets)
deploy/          update.sh, backup scripts, compose files
```

## Client

- **Expo** (current SDK), **Expo Router** for navigation and deep links (`/join/<code>` opens the app through universal links / app links).
- **TanStack Query** for server state; WebSocket events update its cache. Mutations for progress logging are persisted, so they queue offline and replay on reconnect.
- **Typed API client** from the server's Hono routes (`hc`), so the client and server can't disagree on shapes.
- **i18n:** i18next + expo-localization, English catalog only at launch. No hard-coded user-facing strings.
- **UI:** React Native primitives + a small token-based theme (light/dark, warm paper palette, serif headings bundled with the app, not loaded from a CDN). Charts drawn with react-native-svg, which also works on web.
- **Native modules:** expo-apple-authentication (iOS), @react-native-google-signin/google-signin, expo-camera (barcode scan), expo-notifications, expo-secure-store. That means **development builds** (EAS), not Expo Go.
- **Releases:** EAS Build + EAS Submit; EAS Update for over-the-air JS fixes, gated by runtime version. Channels: `preview` → staging API, `production` → production API.

## Server

- **Node 22, Hono, zod validation** on every input. Structured JSON logs (pino), `/healthz` for Docker and the uptime check.
- **Drizzle ORM** + Drizzle Kit migrations, run automatically before the new container takes traffic.
- **Better Auth** with the Drizzle adapter and the Expo plugin:
  - **iOS:** native Sign in with Apple sheet → identity token → server verifies. The authorization code is exchanged for a refresh token, so account deletion can revoke it (Apple requires this).
  - **Android/iOS Google:** native Google sign-in → ID token → server verifies.
  - **Web, and Apple on Android:** standard OAuth redirect.
  - Accounts with the same email are linked only if the existing account confirmed its email (blocks pre-registration takeover). Apple private-relay emails are stored as given.
- **Email/password** (Better Auth): confirmation required before first sign-in, 10+ character passwords checked against Have I Been Pwned (k-anonymity), rate-limited sign-in, reset links valid 1 hour and single-use, all sessions revoked on reset. Sign-up with a taken address answers like a new sign-up; the owner gets a "you already have an account" email instead.
- **Email** goes out through Resend from `noreply@mail.ogun.se` (sending-only key); in development it is written to the server log.
- **Live updates (built):** `GET /api/live` upgrades to a WebSocket for signed-in users from trusted origins only (cookie-authenticated sockets are otherwise open to cross-site hijacking). Events only name what changed (`readings`, `club`, `club-progress`); the app refetches through the normal API, so permissions live in one place. Heartbeat every 25 s; close code 1012 on deploy so apps reconnect immediately. Original design notes: one WebSocket per client. The client subscribes to the clubs it belongs to (membership checked on subscribe), and the server publishes after each committed write: `progress`, `note`, `reply`, `reaction`, `member`, `club`. It's in-process now; Postgres LISTEN/NOTIFY is the upgrade path if we ever run more than one process. Clients refetch after reconnecting, so a missed event costs nothing.
- **Push:** Expo push service (expo-server-sdk), which needs an APNs key and FCM v1 credentials in EAS. Sends are batched, and receipts are checked to prune dead tokens.
- **Jobs** (in-process scheduler, single instance): meeting/milestone reminders, receipt checks, cover cache cleanup.
- **Rate limits:** per user and per IP on writes, book lookups and joining with invite codes (codes are random, 8+ characters and rotatable).

## Books and editions

- **Search** (`GET /api/books/search?q=`) asks Open Library for *works* (a book across all its editions), so the next step can list a work's editions (`GET /api/books/works/:key`, up to 100, stored as `edition` rows with our own ids). The app sorts editions in the reader's languages first and filters them as you type.
- **ISBN** (`GET /api/books/isbn/:isbn`, ISBN-10 or -13, checksum validated): known locally, else Google Books (key stays on the server, ~1,000 requests a day by default), else Open Library. "Nobody knows this ISBN" is remembered for a week.
- **Caching:** provider answers live in `book_cache` (searches and edition lists for 7 days, work summaries 30), editions in `edition`. Repeat questions never reach a provider.
- **Covers** (`GET /api/covers/:key`): keys are `ol-<id>-<S|M|L>` or `g-<volumeId>`, validated before the server builds the provider URL itself (no user-supplied URLs, so no SSRF). Images are fetched once, stored in Postgres (`cover`, so backups include them), and served with immutable cache headers. Only JPEG/PNG/GIF/WebP up to 2 MB.
- **Manual entry** (`POST /api/books/editions`) when no source knows the book: title, authors, page count, optional publisher/year/ISBN.
- Book routes need a session and are rate-limited per user (60 requests and 300 covers a minute), protecting the providers' quotas.
- The barcode scanner (EAN-13, 978/979) comes with the iOS step; on web the ISBN is typed.

## Position model (the core idea)

Every reading has an edition range: `start_page` (default 1) and `end_page` (the confirmed page count; the member can adjust both, for example to skip front matter or back matter).

```
position = clamp((page − start_page) / (end_page − start_page), 0, 1)     stored as an integer 0..10000
page_in_other_edition ≈ start′ + position × (end′ − start′)
```

- E-book readers can log a percentage directly.
- Notes store the author's page, the edition and the position. A reader of the **same edition** sees the exact page, and everyone else sees "≈ p.N".
- **Spoiler rule:** a note or reply is blurred for a viewer when `note.position > viewer.position`. The blur is a presentation choice, so the text is sent and the client hides it. Push notifications for new notes go only to members who have already passed that position, and never include text otherwise.
- The schedule's targets are positions too. The pace line interpolates linearly between the start date, the milestones and the finish date.

All of this lives in `packages/shared` with unit tests.

## Data model (Postgres)

| Table | Key columns |
|---|---|
| `user`, `session`, `account`, `verification` | Better Auth's tables; `user` also has display name and avatar |
| `edition` | source (openlibrary/google/manual) + source_id (unique), isbn13, title, subtitle, authors[], publisher, published, page_count, language (ISO 639-2), work_key, cover, created_by |
| `book_cache` | key (`search:…`, `work:…`, `editions:…`, `isbn-missing:…`), value, fetched_at |
| `cover` | key, content_type, bytes (null = provider has none), fetched_at |
| `club` | name, description, invite_code (unique, 8 chars without look-alikes), member_cap, created_by |
| `club_member` | club_id + user_id, role (owner/admin/member; one owner per club, enforced by a partial unique index), joined_at |
| `club_book` | club_id, reference edition_id (must have a page count), status (current/finished; one current per club), start_date, finish_date, finished_at |
| `meeting` | club_book_id, starts_at, title, location, read_to_page (in the club's edition) |
| `reading` | user_id, edition_id, book_key (`w:<work>` or `e:<edition>`: which readings are the same book), start_page, end_page, position, current_page, status (reading/finished/stopped; one active per user and book), started_at, finished_at. Personal: clubs show members' readings with the club book's book_key |
| `progress_event` | reading_id, position, page (null for %), created_at; logs within a minute replace each other |
| `note` | club_book_id, author_id, reading_id, parent_id (replies, one level), position, page, body (≤ 2000 chars), created/edited/deleted_at |
| `reaction` | note_id, user_id, emoji (from a fixed set) — unique per user+note+emoji |
| `report` | reporter_id, note_id, reason, status, created_at |
| `block` | blocker_id, blocked_id |
| `push_token` | user_id, token, platform, last_seen |
| `notification_pref` | user_id, type, enabled |

Authorization is enforced in one place: every club-scoped query goes through a membership check helper, and integration tests cover "a non-member gets 404" for every route.

**Deleting an account** removes the user's readings, progress, reactions, tokens and notes. Replies under a deleted note stay, under a "deleted note" placeholder. The Apple token is revoked, and a club the user owns passes to its oldest admin, then its oldest member, or is deleted if it's empty.

## Environments and deployment

| Env | Where | Data |
|---|---|---|
| local | `npm run dev`: API + Expo; PGlite (Postgres in-process, no Docker needed on this PC) | throwaway |
| CI | GitHub Actions with a real Postgres 17 service | throwaway |
| staging | `bookclub-staging.ogun.se` on the VPS, its own compose project and DB | test data |
| production | `bookclub.ogun.se` on the VPS | real |

- Same pattern as sl-karta: a push to `main` runs typecheck, lint and tests, then deploys to staging. Production deploys from a version tag (`v*`). Both use deploy keys restricted to `deploy/update.sh`.
- **Memory limits** on every container (app about 384 MB, Postgres about 512 MB), so a neighbouring project can't starve us and we can't starve them.
- **Backups:** nightly `pg_dump`, compressed and encrypted (age), uploaded to S3-compatible object storage off the VPS. Retention is 7 daily, 4 weekly and 6 monthly. `deploy/restore.sh` restores into a scratch container, and a monthly job runs it and checks row counts. A backup isn't counted until a restore has worked.
- **Monitoring:** Sentry (free tier) for app and server errors, an external uptime check on `/healthz`, and disk/memory alerts.
- **Scaling path:** first give the app its own small VPS, then a bigger VPS or managed Postgres. Each move is "restore the backup there and point DNS at it"; no code changes.

## Testing

- `packages/shared`: unit tests (Vitest) for position math, pace line, spoiler rule, ISBN validation.
- `apps/server`: integration tests per route against Postgres (PGlite locally, real Postgres in CI), including authorization and rate limits. Book providers are stubbed with recorded responses.
- `apps/mobile`: component tests for the key screens. Playwright end-to-end on the web build for the core loop: sign in (test auth provider in non-prod only), create club, join by link, log progress, see it live in a second browser, add a note, spoiler blur.
- Manual device checks on TestFlight / the Play internal track before each store release.

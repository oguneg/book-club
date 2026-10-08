# Plan

Build order for v1, top to bottom. Each stage ends deployed to staging and checked on web plus at least one device build. Scope: [PRODUCT.md](../PRODUCT.md). Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Stages

- [ ] **Foundations:** monorepo, shared package, Hono server with `/healthz`, Drizzle + migrations, Expo app shell (router, theme tokens, fonts, i18n), CI (typecheck, lint, test), Docker + compose with memory limits, staging live at bookclub-staging.ogun.se.
- [ ] **Accounts:** Google and Apple sign-in on iOS, Android and web; profile (name, avatar); sign out everywhere; account deletion with Apple token revocation; data export.
- [ ] **Books:** search, ISBN lookup, barcode scan, provider fallback + cache, cover proxy, manual entry, edition picker with page-count confirmation.
- [ ] **Clubs:** create, invite link and code (rotate), join through universal links / app links, members and roles, remove a member, leave, transfer ownership, set the club book, finish date and milestones, past books.
- [ ] **Progress:** pick your edition for the club book, log a page or %, offline queue, history, club chart (positions + pace line + over time, with a text equivalent), live updates over WebSocket.
- [ ] **Notes:** add a note on a page, notes list by position with "≈ p.N" mapping, spoiler blur and tap to reveal, replies, reactions, edit/delete, report, block, owner moderation.
- [ ] **Notifications:** push token registration, per-type preferences, note/reply/finish events (spoiler-safe), milestone reminders, receipt pruning.
- [ ] **Production hardening:** encrypted off-site backups + tested restore, Sentry, uptime check, rate limits reviewed, privacy policy / terms / support pages, accessibility pass, design pass (warm & bookish), store listings and screenshots.
- [ ] **Release:** TestFlight beta, Google Play closed test (12 testers × 14 days), production deploy of the API, store submissions.

## Needs you (only you can do these)

Start the slow ones early; nothing below blocks Foundations.

- [ ] **Google Play Console** account ($25, one-time). Slowest item: identity verification, then the mandatory 12-tester / 14-day closed test before production.
- [x] **DNS at Hostinger:** A records `bookclub` and `bookclub-staging` → 57.129.169.251.
- [ ] **Expo account** (free) for EAS builds and updates.
- [ ] **Google Cloud project:** OAuth consent screen (app name, support email, privacy link), OAuth client IDs (web, iOS, Android), a Books API key. (accounts + books stages; I'll write the click-by-click steps.)
- [ ] **Apple Developer:** App ID with Sign in with Apple + push, a Services ID for web sign-in, a Sign in with Apple key and an APNs key. (accounts + notifications stages; steps provided.)
- [ ] **Firebase project** for Android push (FCM v1 credentials go into EAS, not into the repo). (notifications stage)
- [ ] **Object storage bucket** for backups (OVH Object Storage, Backblaze B2 or Cloudflare R2; all a few cents a month at our size). (hardening stage)
- [ ] **Sentry account** (free). (hardening stage)
- [ ] **Secrets on the VPS** (`.env` files) and GitHub deploy-key secrets, the same way as for Pace.

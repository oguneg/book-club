# Plan

Build order, top to bottom. **Web first**: everything is built and checked in the browser; screens stay React Native
code so they carry over to iOS later. Each step ends deployed to staging (https://bookclub-staging.ogun.se) for the
owner to click through. Scope: [PRODUCT.md](../PRODUCT.md). Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Phase A: accounts (web)

- [x] **Foundations:** monorepo, shared package, Hono server with `/healthz`, Drizzle + migrations, Expo app shell (router, theme tokens, fonts, i18n), CI (typecheck, lint, test), Docker + compose with memory limits, staging live.
- [x] **1. Email + password:** sign up, sign in, sign out, confirm email, forgot password, display name. 10+ character passwords, leaked-password check, rate-limited sign-in. Locally, emails are written to the server log.
- [ ] **2. Real email on staging:** Resend, sending from `noreply@mail.ogun.se`.
- [ ] **3. Google sign-in:** same account when the email matches an existing one.
- [ ] **4. Account management:** change password, download my data, delete my account.

## Phase B: the book club (web)

- [ ] **5. Books:** search by title/ISBN with cache (Google Books, Open Library fallback), cover proxy, manual entry, edition picker with page-count confirmation. ISBN is typed on web; the barcode scanner comes with iOS.
- [ ] **6. Clubs:** create, invite link and code (rotate), join, members and roles, remove a member, leave, transfer ownership, set the club book, finish date and meetings, past books.
- [ ] **7. Progress:** pick your edition, log a page or %, offline queue, history, club chart (positions + pace line + over time, with a text equivalent), live updates over WebSocket.
- [ ] **8. Notes:** notes on a page, list by position with "≈ p.N" mapping, spoiler blur and tap to reveal, replies, reactions, edit/delete, report, block, owner moderation. Activity shows in the app; no push or email notifications on web for now.

## Phase C: go live on web

- [ ] **9. Hardening:** encrypted off-site backups + tested restore, error tracking, uptime check, rate limits reviewed, privacy policy / terms / support pages, accessibility pass, design pass (warm & bookish).
- [ ] **10. Production** at bookclub.ogun.se: deploy from version tags behind an approval step; a new version that fails its health check must leave the previous one serving (unlike staging today). Google consent screen published.

## Later

- [ ] **iOS:** EAS builds (Expo account `ogunse` is linked), Sign in with Apple (required once Google sign-in is offered), native Google sign-in, push notifications, barcode scanner, TestFlight, App Store.
- [ ] **Android (much later):** Play Console, the mandatory 12-tester / 14-day closed test, Play Store.

## Needs the owner

- [x] DNS at Hostinger: `bookclub`, `bookclub-staging` → 57.129.169.251; Resend records for `mail.ogun.se`.
- [x] Expo account, project linked.
- [x] Resend account; sending-only API key on the VPS.
- [x] Google Cloud project: consent screen (Testing, test users added), web OAuth client; secret on the VPS.
- [ ] Google Books API key, same Cloud project (step 5).
- [ ] Object storage bucket for backups (step 9).
- [ ] Error tracking account, e.g. Sentry free tier (step 9).
- [ ] Later: Apple Developer setup (iOS), Google Play Console (Android).

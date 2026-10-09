# Plan

Build order, top to bottom. **Web first**: everything is built and checked in the browser; screens stay React Native
code so they carry over to iOS later. Each step ends deployed to staging (https://bookclub-staging.ogun.se) for the
owner to click through. Scope: [PRODUCT.md](../PRODUCT.md). Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Phase A: accounts (web)

- [x] **Foundations:** monorepo, shared package, Hono server with `/healthz`, Drizzle + migrations, Expo app shell (router, theme tokens, fonts, i18n), CI (typecheck, lint, test), Docker + compose with memory limits, staging live.
- [x] **1. Email + password:** sign up, sign in, sign out, confirm email, forgot password, display name. 10+ character passwords, leaked-password check, rate-limited sign-in. Locally, emails are written to the server log.
- [x] **2. Real email on staging:** Resend, sending from `noreply@mail.ogun.se`.
- [x] **3. Google sign-in:** same account when the email matches an existing one.
- [x] **4. Account management:** change password, download my data, delete my account.

## Phase B: the book club (web)

- [x] **5. Books:** search by title (Open Library works → their editions) or ISBN (Google Books, then Open Library), all cached; cover proxy; manual entry. ISBN is typed on web; the barcode scanner comes with iOS. Confirming your copy's page numbers moved to step 7, where it's saved with your reading.
- [x] **6. Clubs:** create, invite link and code (rotate), join (the invite survives signing up), members and roles (owner / admins / members), remove a member, leave, transfer ownership, set the club book through the book search in picking mode, start and finish dates, meetings with "read up to page N", past books. Deleting an account hands owned clubs to an admin or the longest-standing member.
- [x] **7. Reading progress, with or without a club:** start reading any book (pick your edition, confirm the story's first and last page), log a page or %, history, finish / stop / read again, your shelf. Clubs show their members' readings of the club book (any edition of the same work): positions with the pace line (start → meeting targets → finish date), progress over time, live updates over WebSocket (also across your own devices). Offline logging moves to the iOS step.
- [x] **8. Notes, for readers in and out of clubs:** notes on a page (or %) for yourself, a club reading the book, or everyone reading it; placed by position so they line up across editions ("≈ p.N"); in book order with a "you are here" line, blurred past it, tap to reveal. On your reading (all / everyone's / per club / mine), the club page (club notes) and the book page (everyone's). Replies, reactions, edit/delete, report (hides it for you; 3 reports hide a public note), block (both ways; unblock from your account), club admins remove club notes. Live updates. The data export now covers clubs, readings, notes, reactions, reports and blocks. No push or email notifications on web for now; reviewing reports is a step 9 tool.

## Phase C: go live on web

- [ ] **9. Hardening:**
  - [x] Rate limits reviewed: 64 KB request bodies, club writes and new clubs, data export, live sockets per account.
  - [x] Reviewing reported notes: moderators listed in `ADMIN_EMAILS` keep or remove them, and get an email when one is hidden.
  - [x] Accessibility pass: axe on every screen in light and dark (no violations), 3:1 borders on form controls, one h1 per page with h2 sections, a main landmark, labelled progress bars, decorative covers hidden. A screen-reader pass on a phone comes with iOS.
  - [x] Book cache pruned daily (lookups after 30 days, covers after 6 months), so the database grows with users, not with browsing.
  - [x] Encrypted off-site backups + a tested restore: nightly restic to Backblaze B2 (EU), one key per environment limited to its own prefix; CI restores every push, and a restore was rehearsed on staging. Production gets its own key (`production/`) in step 10.
  - [ ] Error tracking: built (server errors and app crashes, through our server, to Sentry EU); waiting for the two DSNs in the VPS `.env`.
  - [ ] Uptime check on `/api/health` plus the backup heartbeat: set up in Better Stack (owner).
  - [x] Privacy policy, terms and help pages (`/privacy`, `/terms`, `/help`), linked from sign-in, sign-up and the account page. support@ogun.se needs forwarding set up.
  - [ ] Design pass (warm & bookish).
- [ ] **10. Production** at bookclub.ogun.se: deploy from version tags behind an approval step; a new version that fails its health check must leave the previous one serving (unlike staging today). Google consent screen published.

## Later

- [ ] **iOS:** EAS builds (Expo account `ogunse` is linked), Sign in with Apple (required once Google sign-in is offered), native Google sign-in, push notifications, barcode scanner, TestFlight, App Store.
- [ ] **Android (much later):** Play Console, the mandatory 12-tester / 14-day closed test, Play Store.

## Needs the owner

- [x] DNS at Hostinger: `bookclub`, `bookclub-staging` → 57.129.169.251; Resend records for `mail.ogun.se`.
- [x] Expo account, project linked.
- [x] Resend account; sending-only API key on the VPS.
- [x] Google Cloud project: consent screen (Testing, test users added), web OAuth client; secret on the VPS.
- [x] Google Books API key on the VPS. Its ISBN search returns nothing for fielded queries (`isbn:`), so lookups fall through to Open Library; revisit if Google fixes it.
- [x] Backblaze B2 bucket for backups (EU), staging key on the VPS.
- [ ] Error tracking account, e.g. Sentry free tier (step 9).
- [ ] Later: Apple Developer setup (iOS), Google Play Console (Android).

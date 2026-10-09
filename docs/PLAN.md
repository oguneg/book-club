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
- [ ] **7. Reading progress, with or without a club:** start reading any book (pick your edition, confirm the story's first and last page), log a page or %, history, finish / stop / read again, your shelf. Clubs show their members' readings of the club book (any edition of the same work): positions with the pace line (start → meeting targets → finish date), progress over time, live updates over WebSocket (also across your own devices). Offline logging moves to the iOS step.
- [ ] **8. Notes, for readers in and out of clubs:** notes on a page, shown to everyone reading the same book (public) or only to a club; placed by position so they line up across editions ("≈ p.N"); blurred if ahead of your own reading, tap to reveal; replies, reactions, edit/delete, report, block, moderation. Activity shows in the app; no push or email notifications on web for now.

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
- [ ] Google Books API key, same Cloud project (step 5): enable the Books API, create a key restricted to it, put it on the VPS as `GOOGLE_BOOKS_API_KEY`.
- [ ] Object storage bucket for backups (step 9).
- [ ] Error tracking account, e.g. Sentry free tier (step 9).
- [ ] Later: Apple Developer setup (iOS), Google Play Console (Android).

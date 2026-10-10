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

- [x] **9. Hardening:**
  - [x] Rate limits reviewed: 64 KB request bodies, club writes and new clubs, data export, live sockets per account.
  - [x] Reviewing reported notes: moderators listed in `ADMIN_EMAILS` keep or remove them, and get an email when one is hidden.
  - [x] Accessibility pass: axe on every screen in light and dark (no violations), 3:1 borders on form controls, one h1 per page with h2 sections, a main landmark, labelled progress bars, decorative covers hidden. A screen-reader pass on a phone comes with iOS.
  - [x] Book cache pruned daily (lookups after 30 days, covers after 6 months), so the database grows with users, not with browsing.
  - [x] Encrypted off-site backups + a tested restore: nightly restic to Backblaze B2 (EU), one key per environment limited to its own prefix; CI restores every push, and a restore was rehearsed on staging. Production gets its own key (`production/`) in step 10.
  - [x] Error tracking: server errors and app crashes, through our server, to Sentry (EU, two projects); live on staging.
  - [x] Uptime check on `/api/health` and a heartbeat from the nightly backup, in Better Stack.
  - [x] Privacy policy, terms and help pages (`/privacy`, `/terms`, `/help`), linked from sign-in, sign-up and the account page. support@ogun.se needs forwarding set up.
  - [x] Design pass, "reading journal": home is the book you’re in with a one-step page log on the only raised surface; notes carry page numbers in the margin; a bookmark ribbon shows where you are; sections are set in type instead of boxed cards; owner tools sit together under Manage; a side rail from 1024px. Recorded in `apps/mobile/DESIGN.md`.
  - [x] Simpler to use: three tabs (Reading · Clubs · You, a sidebar from 1024px). The Reading tab is the book you're in, with "Update page" (+5 / +10 / +25) and "+ Note" in sheets and notes as bubbles along the book line. Starting a book is search → Start reading, with the edition picked for you. A club is one line of members' faces and notes, then Notes · Meetings · Members; owner tools sit behind the gear. Recorded in `apps/mobile/DESIGN.md`.
  - [x] My books tab (replaces Reading): Reading · Want to read · Read. Every book you're reading has its own "Update page", so several books are one tap each; "Want to read" is saved from a book's page and comes off the list when you start it. Included in the data export.
  - [x] Simpler flows (critique 25/40): one page per book (a club book's page carries the club's faces, the next meeting and a Club · Everyone notes switch; the club page is the book, who's where and meetings); starting opens "Where are you?"; finishing is one tap with a quiet ending and Undo; a new club is set up in three skippable steps; faces never merge with you and say where everyone is in your own pages; abridged editions are no longer the default.
  - [x] A livelier, app-like structure: four tabs (Home · My books · Clubs · You), each with its own history so the tab bar or sidebar never disappears, and headers with a back arrow. Home shows your books face out and what your clubs did lately (spoiler-safe, from a new `/api/activity`). Covers are borrowed from other editions when the picked one has none; people get photos or their own colour; progress animates and a toast says "+26 pages".
  - [x] The rest of the livelier pass: "Your reading" on the You tab (pages this week, books and pages this year, a 12-week calendar with a text summary and list, the year's shelf; `/api/reading-stats`), a one-line week on Home, "That's your 7th book this year" when you finish, popular books on empty shelves (`/api/books/popular`, Open Library's weekly trending), a success haptic on phones when you log, and My books as list + book side by side from 1200px.
- [ ] **9b. TestFlight** (before production), against staging:
  - [x] The app works natively: the session lives in secure storage (Better Auth's Expo plugin), our API and live updates get it as a header, Google sign-in returns through `bookclub://`, covers are public so images load without a session.
  - [x] Sign in with Apple on iPhones (App Review 4.8, since Google sign-in is offered): Apple's ID token, checked against the bundle ID `se.ogun.bookclub`; no Apple secret needed.
  - [x] `eas.json`: a `testflight` profile (staging API, build numbers kept by EAS) and `production`; `app.json`: Sign in with Apple capability, no non-exempt encryption. `expo-doctor` clean; the iOS bundle exports.
  - [ ] Owner: Apple Developer Program membership; App Store Connect app record (name, primary language, bundle ID `se.ogun.bookclub`, SKU).
  - [ ] Owner, in a terminal: `npx eas-cli@latest build -p ios --profile testflight` (signs in to Apple, lets EAS create the certificate and profile), then `npx eas-cli@latest submit -p ios --latest --profile testflight`.
  - [ ] Owner: add internal testers in App Store Connect › TestFlight; try sign-in (email, Google, Apple), logging, notes, clubs on a phone.
  - [ ] Before the App Store (not needed for TestFlight): revoke Apple tokens on account deletion (Sign in with Apple REST API, needs a key), App Privacy answers, screenshots.
- [ ] **10. Production** at bookclub.ogun.se: deploy from version tags behind an approval step; a new version that fails its health check must leave the previous one serving (unlike staging today). Google consent screen published.

## Later

- [ ] **iOS, after TestFlight:** push notifications, barcode scanner, App Store release.
- [ ] **Android (much later):** Play Console, the mandatory 12-tester / 14-day closed test, Play Store.

## Needs the owner

- [x] DNS at Hostinger: `bookclub`, `bookclub-staging` → 57.129.169.251; Resend records for `mail.ogun.se`.
- [x] Expo account, project linked.
- [x] Resend account; sending-only API key on the VPS.
- [x] Google Cloud project: consent screen (Testing, test users added), web OAuth client; secret on the VPS.
- [x] Google Books API key on the VPS. Its ISBN search returns nothing for fielded queries (`isbn:`), so lookups fall through to Open Library; revisit if Google fixes it.
- [x] Backblaze B2 bucket for backups (EU), staging key on the VPS.
- [x] Sentry (EU) and Better Stack accounts; DSNs and the heartbeat URL on the VPS.
- [ ] Later: Apple Developer setup (iOS), Google Play Console (Android).

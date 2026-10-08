# Product

<!-- impeccable:product-schema 1 -->

<!-- From the kickoff interview (2026-10-08). Anything marked (open) is undecided. Technical decisions live in docs/ARCHITECTURE.md, the build order in docs/PLAN.md. -->

## Platform

iOS, Android and web from one codebase, all in sync in real time. Signing in on any device shows the same clubs, progress and notes.

## Stack

Expo (React Native + react-native-web) client. Self-hosted TypeScript API + Postgres on the owner's OVH VPS behind the shared Caddy proxy, at https://bookclub.ogun.se (working title and subdomain until the product proves itself). Details in docs/ARCHITECTURE.md.

## Users

Friend groups, colleagues and families who read the same book together and meet to talk about it. They own whatever copy they own: a paperback, a hardcover, a different translation's print run, a Kindle edition. They check in from a phone in bed or on the commute, mostly in short visits: log a page, read what others said, leave a thought. One person in each club (the owner) sets the book and the pace.

## Product Purpose

Keep a reading club reading together between meetings. Everyone logs where they are in their own edition; the club sees one shared picture of who is where, against the pace the club agreed on. Thoughts are pinned to the place in the book where they occurred, so a note on a scene shows up for others when they reach that scene, whatever edition they hold. Success is a club finishing its book on schedule with notes from most members along the way.

## Positioning

Edition-agnostic by design. Members never have to buy the same printing: progress and notes are mapped by position in the book, so a note left on p.120 of a 300-page paperback appears as "≈ p.160" to someone reading a 400-page hardcover, and the club chart compares them fairly.

## Operating Context

Core loop: open the club, log your page (or % on an e-reader), see the club chart move, read notes up to where you are, add your own.

- **Sign in:** Google or Apple, on every platform.
- **Clubs:** private, invite only (link or short code). Owner, admins, members. A user can be in several clubs.
- **Club book:** the owner picks the book via search or ISBN, optionally with a finish date and meeting dates/milestones. One current book; past books stay browsable.
- **Your edition:** each member picks their own edition (search, ISBN or barcode scan, or manual entry) and confirms its page count. Formats: print (pages) and e-book (page or %).
- **Progress:** log a page or percentage; history is kept. The club chart shows every member's position, the pace line (where the club should be today) and progress over time. Updates appear live for everyone.
- **Notes:** written on a page of your edition and shown to others at the matching position in theirs. Notes ahead of your own position are blurred with a spoiler warning and can be revealed with a tap. Threaded replies and emoji reactions.
- **Notifications (push):** new notes in a section you have reached, replies to your notes, a member finishing, meeting/milestone reminders. Each type can be switched off. Notifications never carry spoiler text.
- **Safety:** report a note, block a user, owners/admins remove notes and members. In-app account deletion and data export.

## Capabilities and Constraints

- One codebase for iOS, Android and web; the web app is the full app, not a landing page.
- Real-time: progress and notes from others appear without refreshing.
- Progress logging works offline and syncs when back online.
- English only at launch, but every user-facing string goes through translation catalogs (i18n-ready).
- Free, no payments, no ads, no tracking SDKs.
- App Store rules that shape the product: Sign in with Apple wherever Google sign-in is offered (4.8); report/block/remove for user-generated content (1.2); in-app account deletion including Apple token revocation (5.1.1(v)).
- Book metadata comes from Google Books and Open Library and is often incomplete (missing or wrong page counts, no chapter lists), so the member confirms their edition's page count.
- Percentage mapping is approximate (front matter, illustrations and typesetting differ between editions); the UI says "≈" whenever it converts between editions.
- Users must be 13 or older.
- (open) Final product name and own domain; "Bookclub" and bookclub.ogun.se are working titles. The subdomain must keep working forever once apps ship (old app versions and shared invite links point at it).
- (open) Member cap per club (default 50 until there's a reason to change it).

## Brand Commitments

None confirmed beyond the working name "Bookclub". Design direction: warm and bookish, with paper tones and serif headings; it should feel like a good reading journal, not a productivity tool.

## Evidence on Hand

None yet: no users, testimonials or metrics exist, and none may be invented.

## Product Principles

1. The book is the timeline: everything (progress, notes, schedule) is placed by position in the book, never by edition page alone.
2. Spoilers are opt-in: nothing ahead of you is readable without a deliberate tap, including in notifications.
3. Logging progress takes one action and must never fail silently (offline queue, visible sync state).
4. A club is a private room: invite only, no public profiles, no discovery.
5. Calm, not engagement-bait: notifications are useful and few, with no streak pressure and no ads.

## Accessibility & Inclusion

Supports dynamic type / font scaling, screen readers (every chart has a text equivalent: a list of members and positions), light and dark themes, reduced motion, and 44pt touch targets. Color is never the only signal in charts (names and numbers are labelled).

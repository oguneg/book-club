# Bookclub

A reading club app for iOS, Android and web. Members read their own edition of the club's book, log where they are,
see the whole club's progress on one chart, and leave notes on pages that line up across editions.

Working title; staging runs at https://bookclub-staging.ogun.se. What it does and why: [PRODUCT.md](PRODUCT.md).
How it's built: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Build order and status: [docs/PLAN.md](docs/PLAN.md).

```
apps/mobile      Expo app (iOS, Android, web), Expo Router
apps/server      API: Hono, Drizzle, Postgres
packages/shared  types and logic used by both (position math, API schemas)
deploy/          VPS deploy script
```

## Run it locally

Needs Node 22 (no Docker: the local API uses an embedded Postgres, PGlite, stored in `apps/server/.data/`).

```bash
npm install
```

```bash
npm run dev
```

This starts the API on http://localhost:8787 and the Expo dev server on http://localhost:8081. Press `w` in the
Expo output for the web app, or scan the QR code with Expo Go on a phone on the same Wi-Fi. The app finds the local
API automatically (same host as the dev server, port 8787). If Windows asks whether Node may accept connections on
private networks, allow it, or phones can't reach the API.

Locally, no email is sent: confirmation and password-reset emails, with their links, are written to the API's
log. Google sign-in works locally when `apps/server/.env` (git-ignored) holds `GOOGLE_CLIENT_SECRET`; the public
client ID is in `apps/server/dev.env`. Without the secret the Google button is simply hidden.

To try the production build of the web app served by the production server bundle, like staging does:

```bash
npm run build
```

```bash
npm run preview -w @bookclub/server
```

and open http://localhost:8790.

## Checks

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

Server tests use an in-memory PGlite locally; CI runs them against Postgres 17.

## Database changes

Edit `apps/server/src/db/schema.ts`, then generate a migration and commit it:

```bash
npm run db:generate -w @bookclub/server
```

The server applies pending migrations when it starts.

## Deploying

Pushing to `main` runs CI, then deploys to **staging** (`~/book-club-staging` on the VPS) and checks that
https://bookclub-staging.ogun.se/api/health reports the new commit. Production gets its own checkout, key and
approval gate in the release stage.

One-time setup of an environment on the VPS (already done for staging):

1. DNS A record for the domain → 57.129.169.251.
2. Clone: `git clone https://github.com/oguneg/book-club.git ~/book-club-staging`
3. Create `.env` from `.env.example` with a generated database password (`openssl rand -hex 24`), `chmod 600 .env`.
4. Add a deploy key to `~/.ssh/authorized_keys` restricted with `command="/home/debian/book-club-staging/deploy/update.sh",restrict`
   (see `~/proxy/README.md`), and its private half as the `DEPLOY_SSH_KEY_STAGING` repository secret.
5. Run `~/book-club-staging/deploy/update.sh` once, or push to `main`.

Manual redeploy: `ssh debian@57.129.169.251 ~/book-club-staging/deploy/update.sh`.

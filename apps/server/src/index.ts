import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app';
import { createAuth } from './auth';
import { createBookService } from './books/service';
import { createClubService } from './clubs/service';
import { connectPglite, connectPostgres } from './db/client';
import { logMailer, resendMailer } from './email/mailer';
import { loadEnv } from './env';
import { attachLive, createLiveHub } from './live';
import { moderatorAlerts } from './moderation';
import { createNoteService } from './notes/service';
import { createReadingService } from './readings/service';

const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL, base: { env: env.APP_ENV, version: env.GIT_COMMIT } });

const database = env.DATABASE_URL ? connectPostgres(env.DATABASE_URL) : await connectPglite(env.PGLITE_DIR);
await database.migrate();
log.info({ db: env.DATABASE_URL ? 'postgres' : `pglite:${env.PGLITE_DIR}` }, 'database ready');

const mailer =
  env.EMAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY
    ? resendMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, log })
    : logMailer(log);
const clubs = createClubService({ db: database.db });
const auth = createAuth({ env, db: database.db, mailer, log, beforeUserDelete: (userId) => clubs.releaseClubsOf(userId) });
log.info(
  {
    email: env.EMAIL_TRANSPORT,
    google: Boolean(env.GOOGLE_CLIENT_ID),
    googleBooks: Boolean(env.GOOGLE_BOOKS_API_KEY),
    publicUrl: env.PUBLIC_URL,
    appUrl: env.APP_URL,
  },
  'auth ready',
);

const books = createBookService({ db: database.db, fetch, googleApiKey: env.GOOGLE_BOOKS_API_KEY, log });

const live = createLiveHub({ db: database.db, log });
const readings = createReadingService({ db: database.db, live });

const notes = createNoteService({ db: database.db, live, onHidden: moderatorAlerts({ env, mailer, log }) });

const app = createApp({ env, database, auth, books, clubs, readings, notes, live, log });
const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.API_PORT }, (info) => {
  log.info({ port: info.port }, 'listening');
});
const liveSockets = attachLive(server, { auth, hub: live, trustedOrigins: [...new Set([env.APP_URL, env.PUBLIC_URL, ...env.CORS_ORIGINS])], log });

let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, 'shutting down');
  // Docker sends SIGKILL after 10 s; stop accepting requests, let in-flight ones finish, close the pool.
  const force = setTimeout(() => process.exit(1), 8000);
  force.unref();
  // 1012 "service restart": the app reconnects as soon as the new version is up.
  for (const ws of liveSockets.clients) ws.close(1012, 'restarting');
  server.close(() => {
    database.close().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

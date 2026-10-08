import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app';
import { createAuth } from './auth';
import { connectPglite, connectPostgres } from './db/client';
import { logMailer, resendMailer } from './email/mailer';
import { loadEnv } from './env';

const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL, base: { env: env.APP_ENV, version: env.GIT_COMMIT } });

const database = env.DATABASE_URL ? connectPostgres(env.DATABASE_URL) : await connectPglite(env.PGLITE_DIR);
await database.migrate();
log.info({ db: env.DATABASE_URL ? 'postgres' : `pglite:${env.PGLITE_DIR}` }, 'database ready');

const mailer =
  env.EMAIL_TRANSPORT === 'resend' && env.RESEND_API_KEY
    ? resendMailer({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, log })
    : logMailer(log);
const auth = createAuth({ env, db: database.db, mailer, log });
log.info(
  { email: env.EMAIL_TRANSPORT, google: Boolean(env.GOOGLE_CLIENT_ID), publicUrl: env.PUBLIC_URL, appUrl: env.APP_URL },
  'auth ready',
);

const app = createApp({ env, database, auth, log });
const server = serve({ fetch: app.fetch, hostname: env.HOST, port: env.API_PORT }, (info) => {
  log.info({ port: info.port }, 'listening');
});

let stopping = false;
function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  log.info({ signal }, 'shutting down');
  // Docker sends SIGKILL after 10 s; stop accepting requests, let in-flight ones finish, close the pool.
  const force = setTimeout(() => process.exit(1), 8000);
  force.unref();
  server.close(() => {
    database.close().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

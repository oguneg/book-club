import { serve } from '@hono/node-server';
import pino from 'pino';
import { createApp } from './app';
import { connectPglite, connectPostgres } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();
const log = pino({ level: env.LOG_LEVEL, base: { env: env.APP_ENV, version: env.GIT_COMMIT } });

const database = env.DATABASE_URL ? connectPostgres(env.DATABASE_URL) : await connectPglite(env.PGLITE_DIR);
await database.migrate();
log.info({ db: env.DATABASE_URL ? 'postgres' : `pglite:${env.PGLITE_DIR}` }, 'database ready');

const app = createApp({ env, database, log });
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

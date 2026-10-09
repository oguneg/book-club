import { serveStatic } from '@hono/node-server/serve-static';
import type { HealthResponse, PublicConfig } from '@bookclub/shared';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { Logger } from 'pino';
import type { Auth } from './auth';
import type { BookService } from './books/service';
import type { ClubService } from './clubs/service';
import type { Database } from './db/client';
import type { Env } from './env';
import { accountRoutes } from './routes/account';
import { bookRoutes } from './routes/books';
import { clubRoutes } from './routes/clubs';

export interface AppDeps {
  env: Env;
  database: Database;
  auth: Auth;
  books: BookService;
  clubs: ClubService;
  log: Logger;
}

function cacheControlFor(path: string): string {
  // Hashed bundles from `expo export` never change under the same name.
  if (path.startsWith('/_expo/static/')) return 'public, max-age=31536000, immutable';
  // The HTML must always be revalidated so a deploy shows up immediately.
  if (path === '/' || path.endsWith('.html')) return 'no-cache';
  return 'public, max-age=3600';
}

export function createApp({ env, database, auth, books, clubs, log }: AppDeps) {
  const app = new Hono();

  app.use(async (c, next) => {
    const started = performance.now();
    await next();
    const entry = {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
    };
    if (c.req.path === '/healthz') log.debug(entry, 'request');
    else log.info(entry, 'request');
  });

  app.use(
    secureHeaders({
      // same-site, not same-origin: in development the web app (:8081) loads covers from the API (:8787).
      crossOriginResourcePolicy: 'same-site',
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // react-native-web injects its styles at runtime.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    }),
  );

  if (env.APP_ENV === 'staging') {
    app.use(async (c, next) => {
      await next();
      c.header('X-Robots-Tag', 'noindex, nofollow');
    });
  }

  if (env.CORS_ORIGINS.length > 0) {
    app.use('/api/*', cors({ origin: env.CORS_ORIGINS, credentials: true, exposeHeaders: ['Content-Disposition'] }));
  }

  const health = async (): Promise<[HealthResponse, 200 | 503]> => {
    const db = await database.ping();
    const body: HealthResponse = { status: db ? 'ok' : 'degraded', version: env.GIT_COMMIT, env: env.APP_ENV, db };
    return [body, db ? 200 : 503];
  };
  app.get('/healthz', async (c) => c.json(...(await health())));
  app.get('/api/health', async (c) => c.json(...(await health())));

  const publicConfig: PublicConfig = { google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) };
  app.get('/api/config', (c) => c.json(publicConfig));

  // Sign-up, sign-in, sessions, email confirmation, password reset, Google OAuth.
  app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw));

  app.route('/api/account', accountRoutes({ auth, db: database.db }));
  app.route('/api', bookRoutes({ auth, books }));
  app.route('/api', clubRoutes({ auth, clubs }));

  app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

  if (env.PUBLIC_DIR) {
    const files = serveStatic({ root: env.PUBLIC_DIR });
    const appShell = serveStatic({ root: env.PUBLIC_DIR, path: 'index.html' });
    const notFound = async () => {};

    app.get('*', async (c, next) => {
      const file = await files(c, notFound);
      if (file) {
        file.headers.set('Cache-Control', cacheControlFor(c.req.path));
        return file;
      }
      // Single-page app: any other page path is a client-side route.
      const shell = await appShell(c, notFound);
      if (shell) {
        shell.headers.set('Cache-Control', 'no-cache');
        return shell;
      }
      await next();
    });
  }

  app.onError((error, c) => {
    log.error({ err: error, path: c.req.path }, 'unhandled error');
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}

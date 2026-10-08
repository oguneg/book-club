import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { healthResponse } from '@bookclub/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Database } from './db/client';
import { testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database.close();
});

function appWith(vars: Record<string, string> = {}) {
  return testApp(database, vars).app;
}

describe('health', () => {
  it('reports the version and a working database', async () => {
    for (const url of ['/healthz', '/api/health']) {
      const res = await appWith().request(url);
      expect(res.status).toBe(200);
      const body = healthResponse.parse(await res.json());
      expect(body).toEqual({ status: 'ok', version: 'abc1234', env: 'test', db: true });
    }
  });

  it('answers 503 when the database is down', async () => {
    const down: Database = { ...database, ping: async () => false };
    const res = await testApp(down).app.request('/healthz');
    expect(res.status).toBe(503);
    expect(healthResponse.parse(await res.json()).status).toBe('degraded');
  });
});

describe('api', () => {
  it('answers unknown API paths with JSON 404, even when serving the web app', async () => {
    const res = await appWith({ PUBLIC_DIR: 'does-not-matter' }).request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not_found' });
  });

  it('sends security headers', async () => {
    const res = await appWith().request('/api/health');
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('keeps staging out of search engines', async () => {
    const staging = await appWith({
      APP_ENV: 'staging',
      DATABASE_URL: 'postgres://x@localhost/x',
      PUBLIC_URL: 'https://bookclub-staging.example',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      RESEND_API_KEY: 're_test',
    }).request('/healthz');
    expect(staging.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    const test = await appWith().request('/healthz');
    expect(test.headers.get('x-robots-tag')).toBeNull();
  });

  it('allows configured dev origins only', async () => {
    const app = appWith({ CORS_ORIGINS: 'http://localhost:8081' });
    const allowed = await app.request('/api/health', { headers: { Origin: 'http://localhost:8081' } });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    const other = await app.request('/api/health', { headers: { Origin: 'https://evil.example' } });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('web app', () => {
  let publicDir: string;

  beforeAll(() => {
    // serveStatic resolves `root` against the working directory, as in the container.
    publicDir = path.relative(process.cwd(), mkdtempSync(path.join(tmpdir(), 'bookclub-public-')));
    writeFileSync(path.join(publicDir, 'index.html'), '<!doctype html><title>Bookclub</title>');
    mkdirSync(path.join(publicDir, '_expo/static/js/web'), { recursive: true });
    writeFileSync(path.join(publicDir, '_expo/static/js/web/entry-abc.js'), 'console.log(1)');
    writeFileSync(path.join(publicDir, 'favicon.ico'), 'icon');
  });

  afterAll(() => {
    rmSync(publicDir, { recursive: true, force: true });
  });

  it('serves the app shell without caching', async () => {
    const res = await appWith({ PUBLIC_DIR: publicDir }).request('/');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Bookclub</title>');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('falls back to the app shell for client-side routes', async () => {
    const res = await appWith({ PUBLIC_DIR: publicDir }).request('/clubs/123');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>Bookclub</title>');
    expect(res.headers.get('cache-control')).toBe('no-cache');
  });

  it('caches hashed bundles forever and other files for an hour', async () => {
    const app = appWith({ PUBLIC_DIR: publicDir });
    const bundle = await app.request('/_expo/static/js/web/entry-abc.js');
    expect(bundle.status).toBe(200);
    expect(bundle.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const icon = await app.request('/favicon.ico');
    expect(icon.headers.get('cache-control')).toBe('public, max-age=3600');
  });

  it('is not served when no web build is configured', async () => {
    const res = await appWith().request('/');
    expect(res.status).toBe(404);
  });
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Fetch } from './books/providers';
import type { Database } from './db/client';
import { parseDsn, parseStack } from './monitoring/sentry';
import { Browser, captureMailer, signedInUser, testApp, testDatabase } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

/** The parts of a sent event the tests look at. */
interface SentEvent {
  platform: string;
  request?: { url: string; method?: string };
  exception: { values: { type: string; stacktrace: { frames: { function?: string; abs_path: string; lineno: number; colno: number }[] } }[] };
}

const SERVER_DSN = 'https://serverkey@o1.ingest.de.sentry.io/1001';
const WEB_DSN = 'https://webkey@o1.ingest.de.sentry.io/1002';

/** Captures what would go to Sentry; Open Library answers with something that isn't JSON. */
function network() {
  const sent: { url: string; auth: string; body: string }[] = [];
  const fetchFn: Fetch = async (input, init) => {
    const url = String(input);
    if (url.includes('sentry.io')) {
      sent.push({ url, auth: new Headers(init?.headers).get('x-sentry-auth') ?? '', body: String(init?.body) });
      return new Response('{}');
    }
    if (url.includes('openlibrary.org')) return new Response('<html>not json</html>', { status: 200 });
    throw new Error(`unexpected request to ${url}`);
  };
  const events = () => sent.map((s) => JSON.parse(s.body.split('\n')[2] ?? '{}') as SentEvent);
  const settled = async (count: number) => {
    for (let i = 0; i < 50 && sent.length < count; i++) await new Promise((resolve) => setTimeout(resolve, 10));
  };
  return { sent, fetchFn, events, settled };
}

function setup(vars: Record<string, string>) {
  const net = network();
  const mail = captureMailer();
  const ctx = testApp(database, vars, mail.mailer, net.fetchFn);
  return { ...ctx, net, user: () => signedInUser(ctx.app, ctx.env.APP_URL, mail, 'Ann Reader'), anonymous: new Browser(ctx.app, ctx.env.APP_URL) };
}

const crash = (page: string, message = 'cannot read properties of undefined') => ({
  type: 'TypeError',
  message,
  stack: `TypeError: ${message}\n    at NoteCard (https://bookclub.test/_expo/static/js/web/entry-abc123.js:1:52310)\n    at renderWithHooks (https://bookclub.test/_expo/static/js/web/entry-abc123.js:1:9921)`,
  page,
});

describe('parsing', () => {
  it('reads DSNs and refuses anything else', () => {
    expect(parseDsn(SERVER_DSN)).toEqual({ publicKey: 'serverkey', host: 'o1.ingest.de.sentry.io', projectId: '1001', url: 'https://o1.ingest.de.sentry.io/api/1001/envelope/' });
    expect(parseDsn('http://key@host/1')).toBeNull();
    expect(parseDsn('https://host/1')).toBeNull();
    expect(parseDsn('nonsense')).toBeNull();
    expect(parseDsn(undefined)).toBeNull();
  });

  it('reads V8 and Firefox/Safari stacks, outermost call first', () => {
    const v8 = parseStack('Error: x\n    at inner (/app/dist/server.mjs:10:5)\n    at node:internal/process:1:1\n    at /app/node_modules/hono/dist/x.js:3:4');
    expect(v8.map((f) => [f.function, f.filename, f.lineno, f.colno, f.in_app])).toEqual([
      [undefined, '/app/node_modules/hono/dist/x.js', 3, 4, false],
      ['inner', '/app/dist/server.mjs', 10, 5, true],
    ]);
    const gecko = parseStack('render@https://example.test/a.js:1:200\n@https://example.test/a.js:1:100');
    expect(gecko.map((f) => [f.function, f.abs_path, f.colno])).toEqual([
      [undefined, 'https://example.test/a.js', 100],
      ['render', 'https://example.test/a.js', 200],
    ]);
  });
});

describe('error reports', () => {
  it('reports unexpected server errors with the stack, path and release, and nothing personal', async () => {
    const ctx = setup({ SENTRY_DSN: SERVER_DSN, SENTRY_DSN_WEB: WEB_DSN });
    const { browser, email } = await ctx.user();
    const res = await browser.request(`/api/books/search?q=${encodeURIComponent(`crash test ${Math.random()}`)}`);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'internal' });

    await ctx.net.settled(1);
    expect(ctx.net.sent).toHaveLength(1);
    expect(ctx.net.sent[0]?.url).toBe('https://o1.ingest.de.sentry.io/api/1001/envelope/');
    expect(ctx.net.sent[0]?.auth).toContain('sentry_key=serverkey');
    const [event] = ctx.net.events();
    expect(event).toMatchObject({ platform: 'node', level: 'error', environment: 'test', release: 'abc1234', request: { url: '/api/books/search', method: 'GET' } });
    expect(event?.exception.values[0]?.type).toBe('SyntaxError');
    expect(event?.exception.values[0]?.stacktrace.frames.length).toBeGreaterThan(0);
    expect(ctx.net.sent[0]?.body).not.toContain(email);
    expect(ctx.net.sent[0]?.body).not.toContain('crash test');
  });

  it("forwards the app's crashes, signed out too, to the web project", async () => {
    const ctx = setup({ SENTRY_DSN: SERVER_DSN, SENTRY_DSN_WEB: WEB_DSN });
    expect((await ctx.anonymous.post('/api/client-errors', crash('/sign-in'))).status).toBe(204);
    await ctx.net.settled(1);
    expect(ctx.net.sent[0]?.url).toBe('https://o1.ingest.de.sentry.io/api/1002/envelope/');
    const [event] = ctx.net.events();
    expect(event).toMatchObject({ platform: 'javascript', request: { url: '/sign-in' } });
    expect(event?.exception.values[0]?.stacktrace.frames.at(-1)).toMatchObject({
      function: 'NoteCard',
      abs_path: 'https://bookclub.test/_expo/static/js/web/entry-abc123.js',
      lineno: 1,
      colno: 52310,
    });
  });

  it('refuses page addresses with a query string (reset links carry tokens there) and drops repeats', async () => {
    const ctx = setup({ SENTRY_DSN: SERVER_DSN });
    expect((await ctx.anonymous.post('/api/client-errors', crash('/reset-password?token=secret'))).status).toBe(400);
    expect((await ctx.anonymous.post('/api/client-errors', { ...crash('/'), stack: 'x'.repeat(20_000) })).status).toBe(400);
    for (let i = 0; i < 3; i++) await ctx.anonymous.post('/api/client-errors', crash('/books', 'same error'));
    await ctx.net.settled(1);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ctx.net.sent).toHaveLength(1);
    expect(ctx.net.sent[0]?.body).not.toContain('secret');
  });

  it('sends nothing when no DSN is configured', async () => {
    const ctx = setup({});
    expect((await ctx.anonymous.post('/api/client-errors', crash('/'))).status).toBe(204);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(ctx.net.sent).toEqual([]);
  });
});

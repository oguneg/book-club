import { randomUUID } from 'node:crypto';
import pino from 'pino';
import { createApp } from '../app';
import { createAuth } from '../auth';
import { connectPglite, connectPostgres, type Database } from '../db/client';
import type { EmailMessage, Mailer } from '../email/mailer';
import { loadEnv } from '../env';

export const log = pino({ level: 'silent' });

/** CI sets TEST_DATABASE_URL to a real Postgres; locally tests use an in-memory PGlite. */
export async function testDatabase(): Promise<Database> {
  const url = process.env.TEST_DATABASE_URL;
  const database = url ? connectPostgres(url) : await connectPglite();
  await database.migrate();
  return database;
}

/** Collects emails instead of sending them. */
export function captureMailer() {
  const sent: EmailMessage[] = [];
  const mailer: Mailer = {
    async send(message) {
      sent.push(message);
    },
  };
  /** The last email to `to`, waiting briefly because auth sends in the background. */
  async function lastTo(to: string): Promise<EmailMessage | undefined> {
    for (let i = 0; i < 50; i++) {
      const found = sent.findLast((m) => m.to === to);
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return undefined;
  }
  return { sent, mailer, lastTo };
}

export function testApp(database: Database, vars: Record<string, string> = {}, mailer: Mailer = captureMailer().mailer) {
  const env = loadEnv({ APP_ENV: 'test', GIT_COMMIT: 'abc1234', ...vars });
  const auth = createAuth({ env, db: database.db, mailer, log });
  return { env, auth, app: createApp({ env, database, auth, log }) };
}

/** A unique address per test, so tests can share one database (CI) without colliding. */
export function uniqueEmail(name = 'reader'): string {
  return `${name}-${randomUUID().slice(0, 8)}@example.com`;
}

/** The first link in an email's text. */
export function linkIn(message: EmailMessage | undefined): string {
  const match = message?.text.match(/https?:\/\/\S+/);
  if (!match) throw new Error(`No link in email: ${message?.subject ?? '(none)'}`);
  return match[0];
}

/** Minimal browser: keeps cookies between requests and sends the Origin header like a browser would. */
export class Browser {
  private cookies = new Map<string, string>();

  constructor(
    private readonly app: ReturnType<typeof createApp>,
    private readonly origin: string,
    private readonly ip = '203.0.113.7',
  ) {}

  async request(path: string, init: { method?: string; json?: unknown; headers?: Record<string, string> } = {}) {
    const url = path.startsWith('http') ? new URL(path) : new URL(path, this.origin);
    const headers: Record<string, string> = { Origin: this.origin, 'X-Forwarded-For': this.ip, ...init.headers };
    if (this.cookies.size > 0) headers.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (init.json !== undefined) headers['Content-Type'] = 'application/json';
    const res = await this.app.request(url.pathname + url.search, {
      method: init.method ?? (init.json === undefined ? 'GET' : 'POST'),
      headers,
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
    });
    for (const cookie of res.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';');
      const [name, ...rest] = (pair ?? '').split('=');
      if (!name) continue;
      const value = rest.join('=');
      const expired = attributes.some((a) => /max-age=0/i.test(a.trim())) || value === '';
      if (expired) this.cookies.delete(name.trim());
      else this.cookies.set(name.trim(), value);
    }
    return res;
  }

  post(path: string, json: unknown = {}) {
    return this.request(path, { json });
  }

  async session(): Promise<{ user: { id: string; email: string; name: string; emailVerified: boolean } } | null> {
    const res = await this.request('/api/auth/get-session');
    return (await res.json()) as { user: { id: string; email: string; name: string; emailVerified: boolean } } | null;
  }
}

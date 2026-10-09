import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Fetch } from '../books/providers';

// Error reports to Sentry, sent as envelopes (https://develop.sentry.dev/sdk/data-model/envelopes/) with
// fetch. The official Node SDK brings OpenTelemetry along, which we don't use; errors are all we send.
// Only technical details leave the server: the error, its stack, the release and the path (no query
// string, body, headers or user).

export interface Dsn {
  publicKey: string;
  host: string;
  projectId: string;
  url: string;
}

/** `https://<key>@<host>/<project>` → where and how to send. Null when it isn't a DSN. */
export function parseDsn(dsn: string | undefined): Dsn | null {
  if (!dsn) return null;
  try {
    const u = new URL(dsn);
    const projectId = u.pathname.replace(/^\/+|\/+$/g, '');
    if (u.protocol !== 'https:' || !u.username || !/^\d+$/.test(projectId)) return null;
    return { publicKey: u.username, host: u.host, projectId, url: `https://${u.host}/api/${projectId}/envelope/` };
  } catch {
    return null;
  }
}

export interface Frame {
  function?: string;
  filename: string;
  abs_path: string;
  lineno: number;
  colno: number;
  in_app: boolean;
}

const V8_FRAME = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?\s*$/; // "at fn (file:1:2)" or "at file:1:2"
const GECKO_FRAME = /^\s*(.*?)@(.+?):(\d+):(\d+)\s*$/; // Firefox and Safari: "fn@file:1:2"

/** Stack frames in Sentry's order (outermost call first). Lines that aren't frames are skipped. */
export function parseStack(stack: string | undefined, limit = 50): Frame[] {
  const frames: Frame[] = [];
  for (const line of (stack ?? '').split('\n')) {
    const m = V8_FRAME.exec(line) ?? GECKO_FRAME.exec(line);
    if (!m) continue;
    const [, fn, file, lineno, colno] = m;
    if (!file || file.startsWith('node:') || file === 'native') continue;
    frames.push({
      function: fn || undefined,
      filename: file.replace(/^file:\/\//, ''),
      abs_path: file,
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: !file.includes('/node_modules/'),
    });
    if (frames.length >= limit) break;
  }
  return frames.reverse();
}

export interface ErrorReport {
  platform: 'node' | 'javascript';
  type: string;
  message: string;
  stack?: string;
  /** Path only: no query string (reset links carry tokens there). */
  path?: string;
  method?: string;
  tags?: Record<string, string>;
}

/**
 * Sends error reports in the background. Repeats of the same error within a minute are dropped, and
 * at most 30 reports go out per minute, so a crash loop can't flood the quota or the network.
 */
export function createErrorReporter({
  dsn,
  environment,
  release,
  log,
  fetchFn = fetch,
}: {
  dsn: string | undefined;
  environment: string;
  release: string;
  log: Logger;
  fetchFn?: Fetch;
}) {
  const target = parseDsn(dsn);
  if (dsn && !target) log.warn('ignoring a Sentry DSN that is not https://<key>@<host>/<project>');
  const lastSent = new Map<string, number>();
  let windowStart = 0;
  let sentInWindow = 0;

  function allowed(fingerprint: string, now: number): boolean {
    if (now - windowStart > 60_000) {
      windowStart = now;
      sentInWindow = 0;
      for (const [key, at] of lastSent) if (now - at > 60_000) lastSent.delete(key);
    }
    if ((lastSent.get(fingerprint) ?? 0) > now - 60_000 || sentInWindow >= 30) return false;
    lastSent.set(fingerprint, now);
    sentInWindow++;
    return true;
  }

  return {
    enabled: target !== null,

    report(r: ErrorReport): void {
      if (!target) return;
      const now = Date.now();
      if (!allowed(`${r.platform}:${r.type}:${r.message}:${r.path ?? ''}`, now)) return;
      const eventId = randomUUID().replaceAll('-', '');
      const event = {
        event_id: eventId,
        timestamp: now / 1000,
        platform: r.platform,
        level: 'error',
        environment,
        release,
        exception: { values: [{ type: r.type, value: r.message.slice(0, 1000), stacktrace: { frames: parseStack(r.stack) } }] },
        ...(r.path ? { request: { url: r.path, method: r.method }, transaction: r.path } : {}),
        tags: r.tags,
      };
      const body = [JSON.stringify({ event_id: eventId, sent_at: new Date(now).toISOString() }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
      fetchFn(target.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${target.publicKey}, sentry_client=bookclub/1.0`,
        },
        body,
        signal: AbortSignal.timeout(5000),
      })
        .then((res) => {
          if (!res.ok) log.warn({ status: res.status }, 'Sentry refused an error report');
        })
        .catch((err: unknown) => log.warn({ err }, 'could not send an error report'));
    },
  };
}

export type ErrorReporter = ReturnType<typeof createErrorReporter>;

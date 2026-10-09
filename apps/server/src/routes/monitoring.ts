import { clientErrorInput } from '@bookclub/shared';
import { Hono } from 'hono';
import type { ErrorReporter } from '../monitoring/sentry';
import { createRateLimiter } from '../rate-limit';

/**
 * Crashes in the app, forwarded to error tracking. Open to signed-out visitors (sign-in can break too), so
 * it's limited per IP and only ever forwards the validated technical fields.
 */
export function monitoringRoutes({ reporter }: { reporter: ErrorReporter }) {
  const allow = createRateLimiter({ windowMs: 10 * 60_000, max: 30 });
  return new Hono().post('/client-errors', async (c) => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
    if (!allow(ip)) return c.json({ error: 'rate_limited' }, 429);
    const parsed = clientErrorInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
    const { type, message, stack, page } = parsed.data;
    reporter.report({ platform: 'javascript', type, message, stack, path: page, tags: { browser: (c.req.header('user-agent') ?? '').slice(0, 200) } });
    return c.body(null, 204);
  });
}

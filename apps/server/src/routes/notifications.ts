import { markNotificationsReadInput, pushTokenInput, updateNotificationSettingsInput } from '@bookclub/shared';
import { Hono } from 'hono';
import type { Auth } from '../auth';
import type { NotificationService } from '../notifications/service';
import { createRateLimiter } from '../rate-limit';
import { requireSession, type SignedInEnv } from '../session';

/** The bell (your notifications), what you've switched off, and the phones that get pushes. */
export function notificationRoutes({ auth, notifications }: { auth: Auth; notifications: NotificationService }) {
  const allowWrites = createRateLimiter({ windowMs: 60_000, max: 60 });
  const app = new Hono<SignedInEnv>().use(requireSession(auth));
  app.use(async (c, next) => {
    if (c.req.method !== 'GET' && !allowWrites(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    await next();
  });

  app.get('/', async (c) => c.json(await notifications.list(c.get('user').id)));

  app.post('/read', async (c) => {
    const parsed = markNotificationsReadInput.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
    await notifications.markRead(c.get('user').id, parsed.data.ids);
    return c.body(null, 204);
  });

  app.get('/settings', async (c) => c.json({ settings: await notifications.settings(c.get('user').id) }));

  app.put('/settings', async (c) => {
    const parsed = updateNotificationSettingsInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
    return c.json({ settings: await notifications.updateSettings(c.get('user').id, parsed.data) });
  });

  app.put('/devices', async (c) => {
    const parsed = pushTokenInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
    await notifications.addToken(c.get('user').id, parsed.data);
    return c.body(null, 204);
  });

  app.delete('/devices/:token', async (c) => {
    await notifications.removeToken(c.get('user').id, c.req.param('token'));
    return c.body(null, 204);
  });

  return app;
}

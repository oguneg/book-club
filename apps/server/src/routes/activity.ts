import { Hono } from 'hono';
import type { ActivityService } from '../activity/service';
import type { Auth } from '../auth';
import { requireSession, type SignedInEnv } from '../session';

/** Home's feed: what happened lately in your clubs (see ActivityService). */
export function activityRoutes({ auth, activity }: { auth: Auth; activity: ActivityService }) {
  return new Hono<SignedInEnv>().use(requireSession(auth)).get('/', async (c) => c.json({ items: await activity.list(c.get('user').id) }));
}

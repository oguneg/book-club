import { updatePreferencesInput, type AppearancePreference } from '@bookclub/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Auth } from '../auth';
import type { Db } from '../db/client';
import { userPreference } from '../db/schema';
import type { LiveHub } from '../live';
import { requireSession, type SignedInEnv } from '../session';

async function appearanceOf(db: Db, userId: string): Promise<AppearancePreference | null> {
  const [row] = await db.select().from(userPreference).where(eq(userPreference.userId, userId));
  return row ? { style: row.appearanceStyle, mode: row.appearanceMode } : null;
}

/** Your settings across devices; a change reaches your other open devices at once. */
export function preferenceRoutes({ auth, db, live }: { auth: Auth; db: Db; live?: LiveHub }) {
  return new Hono<SignedInEnv>()
    .use(requireSession(auth))
    .get('/', async (c) => c.json({ appearance: await appearanceOf(db, c.get('user').id) }))
    .put('/', async (c) => {
      const parsed = updatePreferencesInput.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: 'invalid_input' }, 400);
      const userId = c.get('user').id;
      const { style, mode } = parsed.data.appearance;
      await db
        .insert(userPreference)
        .values({ userId, appearanceStyle: style, appearanceMode: mode })
        .onConflictDoUpdate({ target: userPreference.userId, set: { appearanceStyle: style, appearanceMode: mode } });
      live?.preferencesChanged(userId);
      return c.json({ appearance: parsed.data.appearance });
    });
}

import { logProgressInput, startReadingInput, updateReadingInput } from '@bookclub/shared';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';
import type { Auth } from '../auth';
import { createRateLimiter } from '../rate-limit';
import { ReadingError, type ReadingService } from '../readings/service';
import { requireSession, type SignedInEnv } from '../session';

const ID = /^[0-9a-f-]{36}$/;

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new ReadingError(400, 'invalid_input');
  return parsed.data;
}

function readingId(c: Context): string {
  const id = c.req.param('id') ?? '';
  if (!ID.test(id)) throw new ReadingError(404, 'not_found');
  return id;
}

export function readingRoutes({ auth, readings }: { auth: Auth; readings: ReadingService }) {
  // Generous: logging is quick taps, but a runaway client shouldn't flood history.
  const allowWrites = createRateLimiter({ windowMs: 60_000, max: 120 });

  const app = new Hono<SignedInEnv>();
  app.use('/readings', requireSession(auth));
  app.use('/readings/*', requireSession(auth));
  app.use('/readings/*', async (c, next) => {
    if (c.req.method !== 'GET' && !allowWrites(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof ReadingError) return c.json({ error: err.code, ...(err.readingId ? { readingId: err.readingId } : {}) }, err.status);
    throw err;
  });

  app.get('/readings', async (c) => c.json({ readings: await readings.list(c.get('user').id) }));

  app.post('/readings', async (c) => c.json({ reading: await readings.start(c.get('user').id, await body(c, startReadingInput)) }, 201));

  app.get('/readings/:id', async (c) => c.json({ reading: await readings.detail(readingId(c), c.get('user').id) }));

  app.patch('/readings/:id', async (c) =>
    c.json({ reading: await readings.update(readingId(c), c.get('user').id, await body(c, updateReadingInput)) }),
  );

  app.delete('/readings/:id', async (c) => {
    await readings.remove(readingId(c), c.get('user').id);
    return c.body(null, 204);
  });

  app.post('/readings/:id/progress', async (c) =>
    c.json({ reading: await readings.logProgress(readingId(c), c.get('user').id, await body(c, logProgressInput)) }),
  );

  app.post('/readings/:id/finish', async (c) => c.json({ reading: await readings.finish(readingId(c), c.get('user').id) }));
  app.post('/readings/:id/stop', async (c) => c.json({ reading: await readings.stop(readingId(c), c.get('user').id) }));
  app.post('/readings/:id/resume', async (c) => c.json({ reading: await readings.resume(readingId(c), c.get('user').id) }));

  return app;
}

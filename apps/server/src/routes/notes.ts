import { createNoteInput, noteBodyInput, reactionInput, reportInput } from '@bookclub/shared';
import { Hono, type Context } from 'hono';
import type { z } from 'zod';
import type { Auth } from '../auth';
import { NoteError, type NoteScope, type NoteService } from '../notes/service';
import { createRateLimiter } from '../rate-limit';
import { requireSession, type SignedInEnv } from '../session';

const ID = /^[0-9a-f-]{36}$/;
const BOOK_KEY = /^(w:OL\d{1,12}W|e:[0-9a-f-]{36})$/;

async function body<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new NoteError(400, 'invalid_input');
  return parsed.data;
}

function noteId(c: Context): string {
  const id = c.req.param('id') ?? '';
  if (!ID.test(id)) throw new NoteError(404, 'not_found');
  return id;
}

export function noteRoutes({ auth, notes }: { auth: Auth; notes: NoteService }) {
  // Writing is deliberate; a burst beyond this is a script or spam.
  const allowWrites = createRateLimiter({ windowMs: 10 * 60_000, max: 40 });
  const allowTaps = createRateLimiter({ windowMs: 60_000, max: 120 });
  const signedIn = requireSession(auth);

  const app = new Hono<SignedInEnv>();
  app.use('/notes', signedIn);
  app.use('/notes/*', signedIn);
  app.use('/blocks', signedIn);
  app.use('/blocks/*', signedIn);
  app.onError((err, c) => {
    if (err instanceof NoteError) return c.json({ error: err.code }, err.status);
    throw err;
  });

  const limited = (allow: (key: string) => boolean) => async (c: Context<SignedInEnv>, next: () => Promise<void>) => {
    if (!allow(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
    await next();
  };

  app.get('/notes', async (c) => {
    const bookKey = c.req.query('book') ?? '';
    if (!BOOK_KEY.test(bookKey)) return c.json({ error: 'invalid_book' }, 400);
    const raw = c.req.query('scope') ?? 'all';
    const scope: NoteScope = raw === 'public' || raw === 'mine' || (raw.startsWith('club:') && ID.test(raw.slice(5))) ? (raw as NoteScope) : 'all';
    return c.json(await notes.list(c.get('user').id, bookKey, scope));
  });

  app.post('/notes', limited(allowWrites), async (c) => c.json(await notes.create(c.get('user').id, await body(c, createNoteInput)), 201));

  app.post('/notes/:id/replies', limited(allowWrites), async (c) =>
    c.json(await notes.reply(c.get('user').id, noteId(c), (await body(c, noteBodyInput)).body), 201),
  );

  app.patch('/notes/:id', limited(allowWrites), async (c) => {
    await notes.edit(c.get('user').id, noteId(c), (await body(c, noteBodyInput)).body);
    return c.body(null, 204);
  });

  app.delete('/notes/:id', async (c) => {
    await notes.remove(c.get('user').id, noteId(c));
    return c.body(null, 204);
  });

  app.post('/notes/:id/reactions', limited(allowTaps), async (c) => {
    await notes.react(c.get('user').id, noteId(c), (await body(c, reactionInput)).emoji);
    return c.body(null, 204);
  });

  app.post('/notes/:id/report', limited(allowWrites), async (c) => {
    await notes.report(c.get('user').id, noteId(c), await body(c, reportInput));
    return c.body(null, 204);
  });

  app.get('/blocks', async (c) => c.json({ blocked: await notes.blocks(c.get('user').id) }));

  app.put('/blocks/:userId', async (c) => {
    await notes.block(c.get('user').id, c.req.param('userId'));
    return c.body(null, 204);
  });

  app.delete('/blocks/:userId', async (c) => {
    await notes.unblock(c.get('user').id, c.req.param('userId'));
    return c.body(null, 204);
  });

  return app;
}

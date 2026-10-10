import { COVER_KEY, manualEditionInput, normalizeIsbn } from '@bookclub/shared';
import { Hono } from 'hono';
import type { Auth } from '../auth';
import type { BookService } from '../books/service';
import { ProviderError } from '../books/providers';
import { createRateLimiter } from '../rate-limit';
import { requireSession, type SignedInEnv } from '../session';

const WORK_KEY = /^OL\d{1,12}W$/;
const EDITION_ID = /^[0-9a-f-]{36}$/;

export function bookRoutes({ auth, books }: { auth: Auth; books: BookService }) {
  // Generous for people, tight enough that one client can't burn the providers' quotas.
  const allowBooks = createRateLimiter({ windowMs: 60_000, max: 60 });
  // A results page shows ~20 covers; most are served from the database after the first view.
  const allowCovers = createRateLimiter({ windowMs: 60_000, max: 300 });

  const signedIn = requireSession(auth);
  const app = new Hono<SignedInEnv>()
    .use('/books/*', signedIn, async (c, next) => {
      if (!allowBooks(c.get('user').id)) return c.json({ error: 'rate_limited' }, 429);
      await next();
    })
    // Covers are public pictures: no session needed (native image requests carry no cookie), so they're
    // limited per address instead of per account.
    .use('/covers/*', async (c, next) => {
      const address = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      if (!allowCovers(address)) return c.json({ error: 'rate_limited' }, 429);
      await next();
    })
    .onError((err, c) => {
      if (err instanceof ProviderError) return c.json({ error: 'provider_unavailable' }, 502);
      throw err;
    });

  app.get('/books/search', async (c) => {
    const q = (c.req.query('q') ?? '').trim();
    if (q.length < 2 || q.length > 200) return c.json({ error: 'invalid_query' }, 400);
    return c.json({ works: await books.searchWorks(q) });
  });

  app.get('/books/popular', async (c) => c.json({ works: await books.popular() }));

  app.get('/books/works/:key', async (c) => {
    const key = c.req.param('key');
    if (!WORK_KEY.test(key)) return c.json({ error: 'not_found' }, 404);
    const result = await books.workWithEditions(key);
    return result ? c.json(result) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/books/isbn/:isbn', async (c) => {
    const isbn = normalizeIsbn(c.req.param('isbn'));
    if (!isbn) return c.json({ error: 'invalid_isbn' }, 400);
    const found = await books.lookupIsbn(isbn);
    return found ? c.json({ edition: found }) : c.json({ error: 'not_found' }, 404);
  });

  app.get('/books/editions/:id', async (c) => {
    const id = c.req.param('id');
    const found = EDITION_ID.test(id) ? await books.getEdition(id) : null;
    return found ? c.json({ edition: found }) : c.json({ error: 'not_found' }, 404);
  });

  app.post('/books/editions', async (c) => {
    const parsed = manualEditionInput.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'invalid_input', issues: parsed.error.issues.map((i) => i.path.join('.')) }, 400);
    if (parsed.data.isbn && !normalizeIsbn(parsed.data.isbn)) return c.json({ error: 'invalid_input', issues: ['isbn'] }, 400);
    return c.json({ edition: await books.createManual(parsed.data, c.get('user').id) }, 201);
  });

  app.get('/covers/:key', async (c) => {
    const key = c.req.param('key');
    if (!COVER_KEY.test(key)) return c.json({ error: 'not_found' }, 404);
    const image = await books.getCover(key);
    if (!image) return c.json({ error: 'not_found' }, 404);
    // A cover never changes under the same key.
    c.header('Cache-Control', 'private, max-age=31536000, immutable');
    c.header('Content-Type', image.contentType);
    return c.body(new Uint8Array(image.bytes));
  });

  return app;
}

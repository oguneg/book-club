import { bookSearchResponse, editionResponse, workEditionsResponse } from '@bookclub/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Fetch } from './books/providers';
import { normalizeQuery } from './books/service';
import { inArray } from 'drizzle-orm';
import type { Database } from './db/client';
import { bookCache, cover } from './db/schema';
import { Browser, captureMailer, linkIn, testApp, testDatabase, uniqueEmail } from './test/helpers';

let database: Database;

beforeAll(async () => {
  database = await testDatabase();
});

afterAll(async () => {
  await database?.close();
});

// Trimmed copies of real provider answers (October 2026). Unique ids per test keep the shared CI database clean.
function fixtures(n: number) {
  const work = `OL${9000 + n}W`;
  const isbnPride = '9780141439518';
  return {
    work,
    isbnPride,
    search: {
      numFound: 2,
      docs: [
        { key: `/works/${work}`, title: 'The Hobbit', author_name: ['J.R.R. Tolkien'], cover_i: 14627509, first_publish_year: 1937, edition_count: 482 },
        { key: '/works/OL1W', title: '', author_name: [] },
      ],
    },
    workDoc: { docs: [{ key: `/works/${work}`, title: 'The Hobbit', author_name: ['J.R.R. Tolkien'], cover_i: 14627509, first_publish_year: 1937, edition_count: 482 }] },
    editions: {
      size: 3,
      entries: [
        { key: `/books/OL${n}1M`, title: 'Hobit ali Tja in spet nazaj', number_of_pages: 380, publishers: ['Mladinska knjiga'], publish_date: '2011', isbn_13: ['9788611171982'], covers: [15261276], languages: [{ key: '/languages/slv' }], works: [{ key: `/works/${work}` }] },
        { key: `/books/OL${n}2M`, title: 'Гобіт, або туди і звідти', publishers: ['Астролябія'], publish_date: '2020', covers: [-1], languages: [{ key: '/languages/ukr' }], works: [{ key: `/works/${work}` }] },
        { key: `/books/OL${n}3M`, title: 'The Hobbit', number_of_pages: 306, publishers: ['The Random House Publishing Group'], publish_date: '1937', isbn_10: ['0345339681'], works: [{ key: `/works/${work}` }] },
      ],
    },
    olIsbn: { key: `/books/OL${n}4M`, title: 'Pride and Prejudice', works: [{ key: '/works/OL66554W' }], languages: [{ key: '/languages/eng' }], number_of_pages: 435, publishers: ['Penguin Books'], publish_date: '2003', covers: [12645114, -1], isbn_13: [isbnPride] },
    prideWork: { docs: [{ key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'], edition_count: 3000 }] },
    google: (isbn: string) => ({
      totalItems: 1,
      items: [{ id: `gVol${n}abcd`, volumeInfo: { title: 'Pride and Prejudice', authors: ['Jane Austen'], publisher: 'Penguin Classics', publishedDate: '2003-04-29', pageCount: 480, language: 'en', industryIdentifiers: [{ type: 'ISBN_13', identifier: isbn }], imageLinks: { thumbnail: 'http://books.google.com/…' } } }],
    }),
  };
}

/** A fake network: answers by URL pattern and records every call. */
function fakeNetwork(routes: [RegExp, () => Response | Promise<Response>][]) {
  const calls: string[] = [];
  const fetchFn: Fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    const route = routes.find(([pattern]) => pattern.test(url));
    if (!route) throw new Error(`no fake for ${url}`);
    return route[1]();
  };
  return { fetchFn, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

let counter = 0;
async function setup(routes: [RegExp, () => Response | Promise<Response>][], vars: Record<string, string> = {}) {
  const n = ++counter + Math.floor(Math.random() * 1e6) * 100;
  const net = fakeNetwork(routes);
  const mail = captureMailer();
  const { app, env, books } = testApp(database, vars, mail.mailer, net.fetchFn);
  const browser = new Browser(app, env.APP_URL);
  const email = uniqueEmail();
  await browser.post('/api/auth/sign-up/email', { email, password: 'correct horse battery', name: 'Ann', callbackURL: `${env.APP_URL}/` });
  await browser.request(linkIn(await mail.lastTo(email)));
  return { browser, calls: net.calls, app, env, books, n };
}

describe('book search', () => {
  it('needs a signed-in user', async () => {
    const { app, env } = testApp(database);
    expect((await new Browser(app, env.APP_URL).request('/api/books/search?q=hobbit')).status).toBe(401);
  });

  it('finds works on Open Library and caches the answer', async () => {
    const f = fixtures(1);
    const ctx = await setup([[/search\.json\?q=the%20hobbit/, () => json(f.search)]]);
    const q = `the hobbit`;
    const res = await ctx.browser.request(`/api/books/search?q=${encodeURIComponent(q)}`);
    expect(res.status).toBe(200);
    const { works } = bookSearchResponse.parse(await res.json());
    expect(works).toEqual([
      { key: f.work, title: 'The Hobbit', authors: ['J.R.R. Tolkien'], firstPublished: 1937, editionCount: 482, cover: 'ol-14627509-M' },
    ]);
    // Same question, differently typed: answered from the cache.
    await ctx.browser.request(`/api/books/search?q=${encodeURIComponent('  The   HOBBIT ')}`);
    expect(ctx.calls.filter((u) => u.includes('search.json'))).toHaveLength(1);
  });

  it('rejects empty queries and reports provider outages', async () => {
    const ctx = await setup([[/search\.json/, () => json({ error: 'busy' }, 503)]]);
    expect((await ctx.browser.request('/api/books/search?q=a')).status).toBe(400);
    const down = await ctx.browser.request(`/api/books/search?q=outage-${ctx.n}`);
    expect(down.status).toBe(502);
    expect(await down.json()).toEqual({ error: 'provider_unavailable' });
  });

  it('normalizes queries for the cache', () => {
    expect(normalizeQuery('  The\tHOBBIT ')).toBe('the hobbit');
  });
});

describe('editions of a work', () => {
  it('lists editions with our ids, most useful first, and stores them', async () => {
    const f = fixtures(2);
    const ctx = await setup([
      [/search\.json\?q=key/, () => json(f.workDoc)],
      [/editions\.json/, () => json(f.editions)],
    ]);
    const res = await ctx.browser.request(`/api/books/works/${f.work}`);
    expect(res.status).toBe(200);
    const { work, editions } = workEditionsResponse.parse(await res.json());
    expect(work.title).toBe('The Hobbit');
    expect(editions.map((e) => e.title)).toEqual(['Hobit ali Tja in spet nazaj', 'The Hobbit', 'Гобіт, або туди і звідти']);
    expect(editions[1]).toMatchObject({ authors: ['J.R.R. Tolkien'], pageCount: 306, isbn13: '9780345339683', cover: null, workKey: f.work });
    expect(editions[0]).toMatchObject({ language: 'slv', cover: 'ol-15261276-M' });

    // Opening the work again uses what's stored.
    const again = workEditionsResponse.parse(await (await ctx.browser.request(`/api/books/works/${f.work}`)).json());
    expect(again.editions.map((e) => e.id)).toEqual(editions.map((e) => e.id));
    expect(ctx.calls.filter((u) => u.includes('editions.json'))).toHaveLength(1);

    const one = await ctx.browser.request(`/api/books/editions/${editions[1]!.id}`);
    expect(editionResponse.parse(await one.json()).edition.title).toBe('The Hobbit');
  });

  it('answers 404 for malformed and unknown works', async () => {
    const ctx = await setup([[/search\.json\?q=key/, () => json({ docs: [] })]]);
    expect((await ctx.browser.request('/api/books/works/not-a-key')).status).toBe(404);
    expect((await ctx.browser.request(`/api/books/works/OL${ctx.n}W`)).status).toBe(404);
  });
});

describe('ISBN lookup', () => {
  it('rejects invalid ISBNs without asking anyone', async () => {
    const ctx = await setup([]);
    expect((await ctx.browser.request('/api/books/isbn/9780141439519')).status).toBe(400);
    expect(ctx.calls).toHaveLength(0);
  });

  it('asks Google Books first when it has a key', async () => {
    const f = fixtures(3);
    const isbn = randomIsbn();
    const ctx = await setup([[/googleapis\.com\/books\/v1\/volumes\?q=isbn:/, () => json(f.google(isbn))]], { GOOGLE_BOOKS_API_KEY: 'test-key' });
    const res = await ctx.browser.request(`/api/books/isbn/${isbn}`);
    expect(res.status).toBe(200);
    expect(editionResponse.parse(await res.json()).edition).toMatchObject({
      source: 'google',
      title: 'Pride and Prejudice',
      authors: ['Jane Austen'],
      pageCount: 480,
      language: 'eng',
      isbn13: isbn,
    });
    expect(ctx.calls[0]).toContain('key=test-key');
  });

  it('falls back to Open Library, with authors from the work', async () => {
    const f = fixtures(4);
    const isbn = randomIsbn();
    const ctx = await setup(
      [
        [/googleapis/, () => json({ totalItems: 0 })],
        [/openlibrary\.org\/isbn\//, () => json({ ...f.olIsbn, isbn_13: [isbn] })],
        [/search\.json\?q=key/, () => json(f.prideWork)],
      ],
      { GOOGLE_BOOKS_API_KEY: 'test-key' },
    );
    const { edition } = editionResponse.parse(await (await ctx.browser.request(`/api/books/isbn/${isbn}`)).json());
    expect(edition).toMatchObject({ source: 'openlibrary', authors: ['Jane Austen'], pageCount: 435, workKey: 'OL66554W', cover: 'ol-12645114-M' });
    // Known now: no provider is asked again.
    const before = ctx.calls.length;
    await ctx.browser.request(`/api/books/isbn/${isbn}`);
    expect(ctx.calls).toHaveLength(before);
  });

  it('remembers ISBNs nobody knows', async () => {
    const isbn = randomIsbn();
    const ctx = await setup([[/openlibrary\.org\/isbn\//, () => new Response('', { status: 404 })]]);
    expect((await ctx.browser.request(`/api/books/isbn/${isbn}`)).status).toBe(404);
    expect((await ctx.browser.request(`/api/books/isbn/${isbn}`)).status).toBe(404);
    expect(ctx.calls).toHaveLength(1);
  });
});

describe('manual entry', () => {
  it('stores a book typed in by hand', async () => {
    const ctx = await setup([]);
    const res = await ctx.browser.post('/api/books/editions', {
      title: '  Min mormors kokbok ',
      authors: ['Okänd'],
      pageCount: 212,
      publisher: 'Eget förlag',
      isbn: '978-0-14-143951-8',
    });
    expect(res.status).toBe(201);
    expect(editionResponse.parse(await res.json()).edition).toMatchObject({
      source: 'manual',
      title: 'Min mormors kokbok',
      pageCount: 212,
      isbn13: '9780141439518',
    });
  });

  it('validates the input', async () => {
    const ctx = await setup([]);
    const missing = await ctx.browser.post('/api/books/editions', { title: '', authors: [], pageCount: 0 });
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { issues: string[] }).issues).toEqual(expect.arrayContaining(['title', 'authors', 'pageCount']));
    const badIsbn = await ctx.browser.post('/api/books/editions', { title: 'X', authors: ['Y'], pageCount: 10, isbn: '123' });
    expect(badIsbn.status).toBe(400);
  });
});

describe('covers', () => {
  it('fetches a cover once and serves it from the database', async () => {
    const id = randomId();
    const ctx = await setup([[/covers\.openlibrary\.org/, () => new Response(JPEG, { headers: { 'Content-Type': 'image/jpeg' } })]]);
    for (let i = 0; i < 2; i++) {
      const res = await ctx.browser.request(`/api/covers/ol-${id}-M`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/jpeg');
      expect(res.headers.get('cache-control')).toContain('immutable');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(JPEG);
    }
    expect(ctx.calls).toEqual([`https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`]);
    // Covers are public pictures: the native app's image requests carry no session.
    expect((await new Browser(ctx.app, ctx.env.APP_URL).request(`/api/covers/ol-${id}-M`)).status).toBe(200);
  });

  it('only fetches known cover sources and remembers missing covers', async () => {
    const id = randomId();
    const ctx = await setup([[/covers\.openlibrary\.org/, () => new Response('', { status: 404 })]]);
    expect((await ctx.browser.request('/api/covers/https%3A%2F%2Fevil.example%2Fx.jpg')).status).toBe(404);
    expect((await ctx.browser.request(`/api/covers/ol-${id}-M`)).status).toBe(404);
    expect((await ctx.browser.request(`/api/covers/ol-${id}-M`)).status).toBe(404);
    expect(ctx.calls).toHaveLength(1);
  });

  it('refuses non-images', async () => {
    const id = randomId();
    const ctx = await setup([[/covers\.openlibrary\.org/, () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } })]]);
    expect((await ctx.browser.request(`/api/covers/ol-${id}-M`)).status).toBe(404);
  });
});

describe('cache housekeeping', () => {
  it('drops lookups past a month and covers past six months, keeping fresher ones', async () => {
    const ctx = await setup([]);
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const lookup = (suffix: string) => `search:housekeeping-${ctx.n}-${suffix}`;
    const coverKey = (suffix: number) => `ol-${ctx.n}${suffix}-M`;
    await database.db.insert(bookCache).values([
      { key: lookup('old'), value: { v: [] }, fetchedAt: daysAgo(31) },
      { key: lookup('fresh'), value: { v: [] }, fetchedAt: daysAgo(29) },
    ]);
    await database.db.insert(cover).values([
      { key: coverKey(1), contentType: 'image/jpeg', bytes: Buffer.from(JPEG), fetchedAt: daysAgo(181) },
      { key: coverKey(2), contentType: 'image/jpeg', bytes: Buffer.from(JPEG), fetchedAt: daysAgo(179) },
    ]);

    await ctx.books.prune();

    const lookups = await database.db.select({ key: bookCache.key }).from(bookCache).where(inArray(bookCache.key, [lookup('old'), lookup('fresh')]));
    const covers = await database.db.select({ key: cover.key }).from(cover).where(inArray(cover.key, [coverKey(1), coverKey(2)]));
    expect(lookups.map((r) => r.key)).toEqual([lookup('fresh')]);
    expect(covers.map((r) => r.key)).toEqual([coverKey(2)]);
  });
});

// Random ids and ISBNs, so tests never collide in the shared CI database.
function randomId(): number {
  return 100_000_000 + Math.floor(Math.random() * 899_999_999);
}

function randomIsbn(): string {
  const core = `979${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const sum = [...core].reduce((acc, ch, i) => acc + Number(ch) * (i % 2 === 0 ? 1 : 3), 0);
  return `${core}${(10 - (sum % 10)) % 10}`;
}

describe('popular books', () => {
  it('lists well-known books with covers from this week, then serves them from the cache', async () => {
    const doc = (i: number, extra: object = {}) => ({ key: `/works/OL${9000 + i}W`, title: `Book ${i}`, author_name: ['A. Writer'], cover_i: 100 + i, edition_count: 40, ...extra });
    const week = { works: [doc(1), doc(2, { cover_i: undefined }), doc(3, { edition_count: 2 }), doc(4), doc(5), doc(6), doc(7), doc(8)] };
    const ctx = await setup([[/trending\/weekly\.json/, () => json(week)]]);
    const first = bookSearchResponse.parse(await (await ctx.browser.request('/api/books/popular')).json()).works;
    // No cover, or too few editions to be well known: left out.
    expect(first.map((w) => w.title)).toEqual(['Book 1', 'Book 4', 'Book 5', 'Book 6', 'Book 7', 'Book 8']);
    expect(first[0]).toMatchObject({ key: 'OL9001W', cover: 'ol-101-M' });
    await ctx.browser.request('/api/books/popular');
    expect(ctx.calls.filter((u) => u.includes('trending'))).toHaveLength(1);
  });
});

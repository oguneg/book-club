import { randomUUID } from 'node:crypto';
import { normalizeIsbn, type Edition, type ManualEditionInput, type WorkSummary } from '@bookclub/shared';
import { and, eq, sql } from 'drizzle-orm';
import type { Logger } from 'pino';
import type { Db } from '../db/client';
import { bookCache, cover, edition } from '../db/schema';
import { fetchCover, googleBooks, openLibrary, type Fetch, type ProviderEdition } from './providers';

const DAY_MS = 24 * 60 * 60 * 1000;
const TTL = {
  search: 7 * DAY_MS,
  work: 30 * DAY_MS,
  editions: 7 * DAY_MS,
  /** "No source knows this ISBN" is retried after a week: books get added. */
  isbnMissing: 7 * DAY_MS,
  coverMissing: 30 * DAY_MS,
};

type EditionRow = typeof edition.$inferSelect;

export function toEdition(row: EditionRow): Edition {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    authors: row.authors,
    publisher: row.publisher,
    published: row.published,
    pageCount: row.pageCount,
    isbn13: row.isbn13,
    language: row.language,
    workKey: row.workKey,
    cover: row.cover,
    source: row.source,
  };
}

const year = (published: string | null) => Number(/\d{4}/.exec(published ?? '')?.[0] ?? 0);

/** Most useful first: editions with a page count and an ISBN, newest first. */
function byUsefulness(a: Edition, b: Edition): number {
  return (
    Number(b.pageCount !== null) - Number(a.pageCount !== null) ||
    Number(b.isbn13 !== null) - Number(a.isbn13 !== null) ||
    year(b.published) - year(a.published) ||
    a.title.localeCompare(b.title)
  );
}

export function normalizeQuery(query: string): string {
  return query.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function createBookService({ db, fetch: fetchFn, googleApiKey, log }: { db: Db; fetch: Fetch; googleApiKey?: string; log: Logger }) {
  const ol = openLibrary(fetchFn);
  const google = googleApiKey ? googleBooks(fetchFn, googleApiKey) : null;

  /** Wrapped as { v } so "nothing found" (null) is cached too. */
  async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const [hit] = await db.select().from(bookCache).where(eq(bookCache.key, key));
    if (hit && Date.now() - hit.fetchedAt.getTime() < ttlMs) return (hit.value as { v: T }).v;
    const value = await load();
    const wrapped = { v: value };
    await db
      .insert(bookCache)
      .values({ key, value: wrapped, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: bookCache.key, set: { value: wrapped, fetchedAt: new Date() } });
    return value;
  }

  /** Stores provider editions (refreshing known ones) and returns them with our ids. */
  async function upsert(found: ProviderEdition[]): Promise<Edition[]> {
    if (found.length === 0) return [];
    const rows = await db
      .insert(edition)
      .values(found.map((e) => ({ id: randomUUID(), ...e })))
      .onConflictDoUpdate({
        target: [edition.source, edition.sourceId],
        set: {
          isbn13: sql`excluded.isbn13`,
          title: sql`excluded.title`,
          subtitle: sql`excluded.subtitle`,
          authors: sql`excluded.authors`,
          publisher: sql`excluded.publisher`,
          published: sql`excluded.published`,
          pageCount: sql`excluded.page_count`,
          language: sql`excluded.language`,
          workKey: sql`coalesce(excluded.work_key, ${edition.workKey})`,
          cover: sql`excluded.cover`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows.map(toEdition);
  }

  async function work(key: string): Promise<WorkSummary | null> {
    return cached(`work:${key}`, TTL.work, () => ol.work(key));
  }

  return {
    async searchWorks(query: string): Promise<WorkSummary[]> {
      const works = await cached(`search:${normalizeQuery(query)}`, TTL.search, () => ol.searchWorks(query));
      // Remember each work's summary, so opening it doesn't ask Open Library again.
      if (works.length > 0) {
        await db
          .insert(bookCache)
          .values(works.map((w) => ({ key: `work:${w.key}`, value: { v: w } })))
          .onConflictDoNothing();
      }
      return works;
    },

    async workWithEditions(key: string): Promise<{ work: WorkSummary; editions: Edition[] } | null> {
      const summary = await work(key);
      if (!summary) return null;
      // Refresh the stored editions from Open Library at most once a week.
      await cached(`editions:${key}`, TTL.editions, async () => {
        await upsert(await ol.editions(key, summary.authors));
        return true;
      });
      const rows = await db.select().from(edition).where(and(eq(edition.workKey, key), eq(edition.source, 'openlibrary')));
      return { work: summary, editions: rows.map(toEdition).sort(byUsefulness) };
    },

    /** Known locally, else Google Books (when configured), else Open Library. */
    async lookupIsbn(isbn13: string): Promise<Edition | null> {
      const [known] = await db.select().from(edition).where(eq(edition.isbn13, isbn13)).orderBy(sql`${edition.source} = 'manual'`).limit(1);
      if (known) return toEdition(known);

      const missKey = `isbn-missing:${isbn13}`;
      const [miss] = await db.select().from(bookCache).where(eq(bookCache.key, missKey));
      if (miss && Date.now() - miss.fetchedAt.getTime() < TTL.isbnMissing) return null;

      let found: ProviderEdition | null = null;
      if (google) {
        try {
          found = await google.isbn(isbn13);
        } catch (err) {
          log.warn({ err, isbn13 }, 'google books lookup failed; trying open library');
        }
      }
      if (!found) {
        found = await ol.isbn(isbn13);
        if (found?.workKey) found = { ...found, authors: (await work(found.workKey))?.authors ?? [] };
      }
      if (!found) {
        await db
          .insert(bookCache)
          .values({ key: missKey, value: { v: true } })
          .onConflictDoUpdate({ target: bookCache.key, set: { fetchedAt: new Date() } });
        return null;
      }
      const [stored] = await upsert([found]);
      return stored ?? null;
    },

    async getEdition(id: string): Promise<Edition | null> {
      const [row] = await db.select().from(edition).where(eq(edition.id, id));
      return row ? toEdition(row) : null;
    },

    async createManual(input: ManualEditionInput, userId: string): Promise<Edition> {
      const [row] = await db
        .insert(edition)
        .values({
          id: randomUUID(),
          source: 'manual',
          sourceId: null,
          isbn13: input.isbn ? normalizeIsbn(input.isbn) : null,
          title: input.title,
          authors: input.authors,
          pageCount: input.pageCount,
          publisher: input.publisher || null,
          published: input.published || null,
          workKey: input.workKey ?? null,
          createdBy: userId,
        })
        .returning();
      return toEdition(row!);
    },

    /** The cover image, fetched from the provider the first time. Null when there is none. */
    async getCover(key: string): Promise<{ contentType: string; bytes: Buffer } | null> {
      const [row] = await db.select().from(cover).where(eq(cover.key, key));
      if (row?.bytes && row.contentType) return { contentType: row.contentType, bytes: row.bytes };
      if (row && Date.now() - row.fetchedAt.getTime() < TTL.coverMissing) return null;
      const image = await fetchCover(fetchFn, key);
      await db
        .insert(cover)
        .values({ key, contentType: image?.contentType ?? null, bytes: image?.bytes ?? null })
        .onConflictDoUpdate({ target: cover.key, set: { contentType: image?.contentType ?? null, bytes: image?.bytes ?? null, fetchedAt: new Date() } });
      return image;
    },
  };
}

export type BookService = ReturnType<typeof createBookService>;

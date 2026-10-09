import { z } from 'zod';

/** A book as a whole ("The Hobbit"), grouping its editions. From Open Library. */
export const workSummary = z.object({
  /** Open Library work id, e.g. "OL27482W". */
  key: z.string(),
  title: z.string(),
  authors: z.array(z.string()),
  firstPublished: z.number().int().nullable(),
  editionCount: z.number().int(),
  /** Pass to /api/covers/{cover}; null when there is no cover. */
  cover: z.string().nullable(),
});
export type WorkSummary = z.infer<typeof workSummary>;

/** One printing of a book: what a member actually holds. */
export const edition = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  publisher: z.string().nullable(),
  /** As the source gives it: "2003", "May 2003", "2003-05-01". */
  published: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  isbn13: z.string().nullable(),
  /** ISO 639-2 code, e.g. "eng", "swe". */
  language: z.string().nullable(),
  workKey: z.string().nullable(),
  cover: z.string().nullable(),
  source: z.enum(['openlibrary', 'google', 'manual']),
});
export type Edition = z.infer<typeof edition>;

export const bookSearchResponse = z.object({ works: z.array(workSummary) });
export const workEditionsResponse = z.object({ work: workSummary, editions: z.array(edition) });
export const editionResponse = z.object({ edition });

export const MAX_PAGE_COUNT = 20_000;

/** A book typed in by hand when no source knows it. */
export const manualEditionInput = z.object({
  title: z.string().trim().min(1).max(300),
  authors: z.array(z.string().trim().min(1).max(200)).min(1).max(10),
  pageCount: z.number().int().min(1).max(MAX_PAGE_COUNT),
  publisher: z.string().trim().max(200).optional(),
  published: z.string().trim().max(40).optional(),
  isbn: z.string().trim().max(20).optional(),
  workKey: z.string().regex(/^OL\d+W$/).optional(),
});
export type ManualEditionInput = z.infer<typeof manualEditionInput>;

/** Cover keys the server can fetch: Open Library cover ids and Google Books volume ids. */
export const COVER_KEY = /^(ol-\d{1,12}-[SML]|g-[A-Za-z0-9_-]{6,20})$/;

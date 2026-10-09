import { z } from 'zod';
import { edition, MAX_PAGE_COUNT } from './books';
import { POSITION_SCALE } from './position';

/**
 * What makes two readings "the same book": the Open Library work when the edition belongs to one (every
 * edition of The Hobbit counts), otherwise the edition itself.
 */
export function bookKeyOf(e: { id: string; workKey: string | null }): string {
  return e.workKey ? `w:${e.workKey}` : `e:${e.id}`;
}

export const readingStatus = z.enum(['reading', 'finished', 'stopped']);
export type ReadingStatus = z.infer<typeof readingStatus>;

export const progressEntry = z.object({
  /** ISO date-time. */
  at: z.string(),
  position: z.number().int().min(0).max(POSITION_SCALE),
  /** The page logged, in this reading's edition; null when logged as a percentage. */
  page: z.number().int().nullable(),
});
export type ProgressEntry = z.infer<typeof progressEntry>;

export const reading = z.object({
  id: z.string(),
  edition,
  bookKey: z.string(),
  startPage: z.number().int(),
  endPage: z.number().int(),
  position: z.number().int().min(0).max(POSITION_SCALE),
  /** Last page logged (or the page matching a logged percentage). */
  currentPage: z.number().int().nullable(),
  status: readingStatus,
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  updatedAt: z.string(),
});
export type Reading = z.infer<typeof reading>;

export const readingDetail = reading.extend({ history: z.array(progressEntry) });
export type ReadingDetail = z.infer<typeof readingDetail>;

export const readingListResponse = z.object({ readings: z.array(reading) });
export const readingResponse = z.object({ reading: readingDetail });

const page = z.number().int().min(1).max(MAX_PAGE_COUNT);

export const startReadingInput = z
  .object({ editionId: z.string().uuid(), startPage: page, endPage: page })
  .refine((r) => r.endPage > r.startPage, { message: 'endPage must be after startPage', path: ['endPage'] });

export const updateReadingInput = z
  .object({ editionId: z.string().uuid().optional(), startPage: page.optional(), endPage: page.optional() })
  .refine((r) => !(r.startPage && r.endPage) || r.endPage > r.startPage, { message: 'endPage must be after startPage', path: ['endPage'] });

// ---- Want to read: books saved for later, each with the edition you'd start in ----

export const wantToRead = z.object({
  id: z.string(),
  edition,
  bookKey: z.string(),
  addedAt: z.string(),
});
export type WantToRead = z.infer<typeof wantToRead>;

export const wantToReadListResponse = z.object({ books: z.array(wantToRead) });
export const wantToReadResponse = z.object({ book: wantToRead });
export const addWantToReadInput = z.object({ editionId: z.string().uuid() });

export const logProgressInput = z.union([
  z.object({ page: z.number().int().min(0).max(MAX_PAGE_COUNT) }),
  z.object({ percent: z.number().min(0).max(100) }),
]);

// ---- A club's view of its members' readings ----

export const memberProgress = z.object({
  userId: z.string(),
  name: z.string(),
  reading: z
    .object({
      id: z.string(),
      position: z.number().int(),
      currentPage: z.number().int().nullable(),
      endPage: z.number().int(),
      editionTitle: z.string(),
      status: readingStatus,
      updatedAt: z.string(),
      history: z.array(z.object({ at: z.string(), position: z.number().int() })),
    })
    .nullable(),
});
export type MemberProgress = z.infer<typeof memberProgress>;

export const clubProgressResponse = z.object({ members: z.array(memberProgress) });

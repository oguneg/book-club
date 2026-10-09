import { randomUUID } from 'node:crypto';
import {
  bookKeyOf,
  pageToPosition,
  percentToPosition,
  POSITION_SCALE,
  positionToPage,
  type MemberProgress,
  type Reading,
  type ReadingDetail,
} from '@bookclub/shared';
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { logProgressInput, startReadingInput, updateReadingInput } from '@bookclub/shared';
import { toEdition } from '../books/service';
import type { Db } from '../db/client';
import { clubBook, clubMember, edition, progressEvent, reading, user } from '../db/schema';
import type { LiveHub } from '../live';

/** Logs this close together replace each other, so adjusting a typo doesn't pile up history. */
const MERGE_WINDOW_MS = 60_000;

export class ReadingError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: string,
    readonly readingId?: string,
  ) {
    super(code);
    this.name = 'ReadingError';
  }
}

type ReadingRow = typeof reading.$inferSelect;
type EditionRow = typeof edition.$inferSelect;

function toReading(r: ReadingRow, e: EditionRow): Reading {
  return {
    id: r.id,
    edition: toEdition(e),
    bookKey: r.bookKey,
    startPage: r.startPage,
    endPage: r.endPage,
    position: r.position,
    currentPage: r.currentPage,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  };
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e.code === '23505' || e.cause?.code === '23505';
}

export function createReadingService({ db, live }: { db: Db; live?: LiveHub }) {
  async function own(id: string, userId: string) {
    const [row] = await db
      .select({ reading, edition })
      .from(reading)
      .innerJoin(edition, eq(edition.id, reading.editionId))
      .where(and(eq(reading.id, id), eq(reading.userId, userId)));
    if (!row) throw new ReadingError(404, 'not_found');
    return row;
  }

  async function detail(id: string, userId: string): Promise<ReadingDetail> {
    const row = await own(id, userId);
    const history = await db
      .select()
      .from(progressEvent)
      .where(eq(progressEvent.readingId, id))
      .orderBy(asc(progressEvent.createdAt));
    return {
      ...toReading(row.reading, row.edition),
      history: history.map((h) => ({ at: h.createdAt.toISOString(), position: h.position, page: h.page })),
    };
  }

  async function changed(userId: string, bookKey: string) {
    await live?.readingChanged(userId, bookKey).catch(() => {});
  }

  async function record(r: ReadingRow, position: number, page: number | null) {
    const [last] = await db
      .select()
      .from(progressEvent)
      .where(eq(progressEvent.readingId, r.id))
      .orderBy(desc(progressEvent.createdAt))
      .limit(1);
    if (last && Date.now() - last.createdAt.getTime() < MERGE_WINDOW_MS) {
      await db.update(progressEvent).set({ position, page, createdAt: new Date() }).where(eq(progressEvent.id, last.id));
    } else {
      await db.insert(progressEvent).values({ id: randomUUID(), readingId: r.id, position, page });
    }
  }

  return {
    detail,

    /** Readings in progress first (most recently logged first), then finished, then stopped. */
    async list(userId: string): Promise<Reading[]> {
      const rows = await db
        .select({ reading, edition })
        .from(reading)
        .innerJoin(edition, eq(edition.id, reading.editionId))
        .where(eq(reading.userId, userId))
        .orderBy(
          sql`case ${reading.status} when 'reading' then 0 when 'finished' then 1 else 2 end`,
          desc(sql`coalesce(${reading.finishedAt}, ${reading.updatedAt})`),
        );
      return rows.map((r) => toReading(r.reading, r.edition));
    },

    async start(userId: string, input: z.infer<typeof startReadingInput>): Promise<ReadingDetail> {
      const [e] = await db.select().from(edition).where(eq(edition.id, input.editionId));
      if (!e) throw new ReadingError(400, 'unknown_edition');
      const bookKey = bookKeyOf(e);
      const [active] = await db
        .select({ id: reading.id })
        .from(reading)
        .where(and(eq(reading.userId, userId), eq(reading.bookKey, bookKey), eq(reading.status, 'reading')));
      if (active) throw new ReadingError(409, 'already_reading', active.id);

      const id = randomUUID();
      try {
        await db.insert(reading).values({ id, userId, editionId: e.id, bookKey, startPage: input.startPage, endPage: input.endPage });
      } catch (err) {
        if (isUniqueViolation(err)) throw new ReadingError(409, 'already_reading');
        throw err;
      }
      await changed(userId, bookKey);
      return detail(id, userId);
    },

    /** Switch to another edition of the same book, or correct the page range. The position stays. */
    async update(id: string, userId: string, input: z.infer<typeof updateReadingInput>): Promise<ReadingDetail> {
      const { reading: r } = await own(id, userId);
      let editionId = r.editionId;
      if (input.editionId && input.editionId !== r.editionId) {
        const [e] = await db.select().from(edition).where(eq(edition.id, input.editionId));
        if (!e) throw new ReadingError(400, 'unknown_edition');
        if (bookKeyOf(e) !== r.bookKey) throw new ReadingError(400, 'different_book');
        editionId = e.id;
      }
      const startPage = input.startPage ?? r.startPage;
      const endPage = input.endPage ?? r.endPage;
      if (endPage <= startPage) throw new ReadingError(400, 'invalid_range');
      const currentPage = r.position > 0 ? positionToPage(r.position, { startPage, endPage }) : null;
      await db.update(reading).set({ editionId, startPage, endPage, currentPage }).where(eq(reading.id, id));
      await changed(userId, r.bookKey);
      return detail(id, userId);
    },

    async logProgress(id: string, userId: string, input: z.infer<typeof logProgressInput>): Promise<ReadingDetail> {
      const { reading: r } = await own(id, userId);
      if (r.status !== 'reading') throw new ReadingError(409, 'not_reading');
      const range = { startPage: r.startPage, endPage: r.endPage };
      let position: number;
      let page: number | null;
      if ('page' in input) {
        if (input.page > r.endPage) throw new ReadingError(400, 'page_out_of_range');
        position = input.page < r.startPage ? 0 : pageToPosition(input.page, range);
        page = input.page;
      } else {
        position = percentToPosition(input.percent);
        page = null;
      }
      await db
        .update(reading)
        .set({ position, currentPage: page ?? (position > 0 ? positionToPage(position, range) : null) })
        .where(eq(reading.id, id));
      await record(r, position, page);
      await changed(userId, r.bookKey);
      return detail(id, userId);
    },

    async finish(id: string, userId: string): Promise<ReadingDetail> {
      const { reading: r } = await own(id, userId);
      if (r.status === 'finished') return detail(id, userId);
      await db
        .update(reading)
        .set({ status: 'finished', position: POSITION_SCALE, currentPage: r.endPage, finishedAt: new Date() })
        .where(eq(reading.id, id));
      await record(r, POSITION_SCALE, r.endPage);
      await changed(userId, r.bookKey);
      return detail(id, userId);
    },

    /** "I stopped reading this": keeps the history, frees the book to be started again. */
    async stop(id: string, userId: string): Promise<ReadingDetail> {
      const { reading: r } = await own(id, userId);
      if (r.status !== 'reading') throw new ReadingError(409, 'not_reading');
      await db.update(reading).set({ status: 'stopped' }).where(eq(reading.id, id));
      await changed(userId, r.bookKey);
      return detail(id, userId);
    },

    /** Back to reading a stopped or finished book (e.g. finished by mistake). */
    async resume(id: string, userId: string): Promise<ReadingDetail> {
      const { reading: r } = await own(id, userId);
      if (r.status === 'reading') return detail(id, userId);
      const [other] = await db
        .select({ id: reading.id })
        .from(reading)
        .where(and(eq(reading.userId, userId), eq(reading.bookKey, r.bookKey), eq(reading.status, 'reading'), ne(reading.id, id)));
      if (other) throw new ReadingError(409, 'already_reading', other.id);
      await db.update(reading).set({ status: 'reading', finishedAt: null }).where(eq(reading.id, id));
      await changed(userId, r.bookKey);
      return detail(id, userId);
    },

    async remove(id: string, userId: string) {
      const { reading: r } = await own(id, userId);
      await db.delete(reading).where(eq(reading.id, id));
      await changed(userId, r.bookKey);
    },

    /**
     * The club's view: each member's most recent reading of the club's current book (any edition), with
     * its history since the club started the book. Members who haven't started have `reading: null`.
     */
    async clubProgress(clubId: string, userId: string): Promise<MemberProgress[]> {
      const [me] = await db
        .select({ role: clubMember.role })
        .from(clubMember)
        .where(and(eq(clubMember.clubId, clubId), eq(clubMember.userId, userId)));
      if (!me) throw new ReadingError(404, 'not_found');

      const members = await db
        .select({ userId: clubMember.userId, name: user.name })
        .from(clubMember)
        .innerJoin(user, eq(user.id, clubMember.userId))
        .where(eq(clubMember.clubId, clubId))
        .orderBy(asc(clubMember.joinedAt));
      const [current] = await db
        .select({ book: clubBook, edition })
        .from(clubBook)
        .innerJoin(edition, eq(edition.id, clubBook.editionId))
        .where(and(eq(clubBook.clubId, clubId), eq(clubBook.status, 'current')));
      if (!current) return members.map((m) => ({ ...m, reading: null }));

      const bookKey = bookKeyOf(current.edition);
      const readings = await db
        .select({ reading, editionTitle: edition.title })
        .from(reading)
        .innerJoin(edition, eq(edition.id, reading.editionId))
        .where(
          and(
            eq(reading.bookKey, bookKey),
            ne(reading.status, 'stopped'),
            inArray(
              reading.userId,
              members.map((m) => m.userId),
            ),
          ),
        )
        .orderBy(desc(reading.startedAt));
      const latest = new Map<string, (typeof readings)[number]>();
      for (const r of readings) if (!latest.has(r.reading.userId)) latest.set(r.reading.userId, r);

      const since = new Date(`${current.book.startDate}T00:00:00Z`);
      const ids = [...latest.values()].map((r) => r.reading.id);
      const events = ids.length
        ? await db
            .select()
            .from(progressEvent)
            .where(and(inArray(progressEvent.readingId, ids), gte(progressEvent.createdAt, since)))
            .orderBy(asc(progressEvent.createdAt))
        : [];

      return members.map((m) => {
        const found = latest.get(m.userId);
        if (!found) return { ...m, reading: null };
        const r = found.reading;
        return {
          ...m,
          reading: {
            id: r.id,
            position: r.position,
            currentPage: r.currentPage,
            endPage: r.endPage,
            editionTitle: found.editionTitle,
            status: r.status,
            updatedAt: r.updatedAt.toISOString(),
            history: events.filter((ev) => ev.readingId === r.id).map((ev) => ({ at: ev.createdAt.toISOString(), position: ev.position })),
          },
        };
      });
    },
  };
}

export type ReadingService = ReturnType<typeof createReadingService>;

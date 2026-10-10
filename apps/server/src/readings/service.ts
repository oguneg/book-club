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
  type ReadingGoals,
  type ReadingStats,
  type WantToRead,
} from '@bookclub/shared';
import { and, asc, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import type { z } from 'zod';
import type { logProgressInput, startReadingInput, updateReadingGoalsInput, updateReadingInput } from '@bookclub/shared';
import { borrowedCovers, toEdition, withCover } from '../books/service';
import type { Db } from '../db/client';
import { clubBook, clubMember, edition, progressEvent, reading, readingGoal, user, wantToRead } from '../db/schema';
import type { LiveHub } from '../live';

/** Logs this close together replace each other, so adjusting a typo doesn't pile up history. */
const MERGE_WINDOW_MS = 60_000;

/** How far back reading days go (enough for any streak worth showing). */
const READING_DAYS_BACK_MS = 2 * 366 * 24 * 60 * 60 * 1000;

/** Dates as YYYY-MM-DD in a time zone the app sent; one we don't know (or none) means UTC. */
function dayFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
  try {
    if (timeZone && timeZone.length <= 64) return new Intl.DateTimeFormat('en-CA', { ...options, timeZone });
  } catch {
    // An unknown zone: fall through.
  }
  return new Intl.DateTimeFormat('en-CA', { ...options, timeZone: 'UTC' });
}

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

function toReading(r: ReadingRow, e: EditionRow, covers: Map<string, string> = new Map()): Reading {
  return {
    id: r.id,
    edition: withCover(toEdition(e), covers),
    bookKey: r.bookKey,
    startPage: r.startPage,
    endPage: r.endPage,
    position: r.position,
    currentPage: r.currentPage,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
    targetDate: r.targetDate ?? null,
    targetSetAt: r.targetSetAt?.toISOString() ?? null,
    targetFrom: r.targetFrom ?? null,
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
    const covers = await borrowedCovers(db, [row.edition]);
    const history = await db
      .select()
      .from(progressEvent)
      .where(eq(progressEvent.readingId, id))
      .orderBy(asc(progressEvent.createdAt));
    return {
      ...toReading(row.reading, row.edition, covers),
      history: history.map((h) => ({ at: h.createdAt.toISOString(), position: h.position, page: h.page })),
    };
  }

  async function changed(userId: string, bookKey: string) {
    await live?.readingChanged(userId, bookKey).catch(() => {});
  }

  async function lastEvent(readingId: string) {
    const [last] = await db.select().from(progressEvent).where(eq(progressEvent.readingId, readingId)).orderBy(desc(progressEvent.createdAt)).limit(1);
    return last;
  }

  /** Adds a point to the history at `at`, folding it into the last one when that was less than a minute before. */
  async function record(r: ReadingRow, position: number, page: number | null, at = new Date()) {
    const last = await lastEvent(r.id);
    const since = last ? at.getTime() - last.createdAt.getTime() : Infinity;
    if (last && since >= 0 && since < MERGE_WINDOW_MS) {
      await db.update(progressEvent).set({ position, page, createdAt: at }).where(eq(progressEvent.id, last.id));
    } else {
      await db.insert(progressEvent).values({ id: randomUUID(), readingId: r.id, position, page, createdAt: at });
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
      const covers = await borrowedCovers(db, rows.map((r) => r.edition));
      return rows.map((r) => toReading(r.reading, r.edition, covers));
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
      // Started, so no longer "want to read".
      await db.delete(wantToRead).where(and(eq(wantToRead.userId, userId), eq(wantToRead.bookKey, bookKey)));
      await changed(userId, bookKey);
      return detail(id, userId);
    },

    /**
     * Your reading, gently counted: pages moved forward in the last 12 weeks (each in its own book's
     * copy), books finished this year, and pages this year. Corrections backwards don't count.
     */
    /** Lately, this year, and the days with reading (as dates in `timeZone`, for the weekly streak). */
    async stats(userId: string, { now = new Date(), timeZone }: { now?: Date; timeZone?: string } = {}): Promise<ReadingStats> {
      const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      const recentStart = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
      const daysStart = new Date(now.getTime() - READING_DAYS_BACK_MS);
      const dayOf = dayFormatter(timeZone);
      const readingDays = new Set<string>();
      const rows = await db.select({ reading, edition }).from(reading).innerJoin(edition, eq(edition.id, reading.editionId)).where(eq(reading.userId, userId));
      const events = rows.length
        ? await db
            .select()
            .from(progressEvent)
            .where(inArray(progressEvent.readingId, rows.map((r) => r.reading.id)))
            .orderBy(asc(progressEvent.createdAt))
        : [];
      const recent: ReadingStats['recent'] = [];
      let pagesThisYear = 0;
      for (const { reading: r } of rows) {
        const pageCount = Math.max(1, r.endPage - r.startPage + 1);
        let previous = 0;
        for (const ev of events.filter((e) => e.readingId === r.id)) {
          const pages = Math.round(((ev.position - previous) / POSITION_SCALE) * pageCount);
          previous = ev.position;
          if (pages <= 0) continue;
          if (ev.createdAt >= recentStart) recent.push({ at: ev.createdAt.toISOString(), pages });
          if (ev.createdAt >= yearStart) pagesThisYear += pages;
          if (ev.createdAt >= daysStart) readingDays.add(dayOf.format(ev.createdAt));
        }
      }
      const finished = rows
        .filter((r) => r.reading.status === 'finished' && r.reading.finishedAt && r.reading.finishedAt >= yearStart)
        .sort((a, b) => b.reading.finishedAt!.getTime() - a.reading.finishedAt!.getTime());
      const covers = await borrowedCovers(db, finished.map((r) => r.edition));
      return {
        recent: recent.sort((a, b) => a.at.localeCompare(b.at)),
        finishedThisYear: finished.map((r) => ({
          id: r.reading.id,
          title: r.edition.title,
          cover: withCover(r.edition, covers).cover,
          finishedAt: r.reading.finishedAt!.toISOString(),
        })),
        pagesThisYear,
        readingDays: [...readingDays].sort(),
      };
    },

    async goals(userId: string): Promise<ReadingGoals> {
      const [row] = await db.select().from(readingGoal).where(eq(readingGoal.userId, userId));
      return { yearlyBooks: row?.yearlyBooks ?? null, dailyPages: row?.dailyPages ?? null };
    },

    /** Sets the goals given (null clears one); the others stay as they were. */
    async setGoals(userId: string, input: z.infer<typeof updateReadingGoalsInput>): Promise<ReadingGoals> {
      const [row] = await db.select().from(readingGoal).where(eq(readingGoal.userId, userId));
      const next: ReadingGoals = {
        yearlyBooks: input.yearlyBooks === undefined ? (row?.yearlyBooks ?? null) : input.yearlyBooks,
        dailyPages: input.dailyPages === undefined ? (row?.dailyPages ?? null) : input.dailyPages,
      };
      if (next.yearlyBooks === null && next.dailyPages === null) {
        await db.delete(readingGoal).where(eq(readingGoal.userId, userId));
      } else {
        await db.insert(readingGoal).values({ userId, ...next }).onConflictDoUpdate({ target: readingGoal.userId, set: next });
      }
      return next;
    },

    /** Books saved for later, most recently added first. */
    async wantList(userId: string): Promise<WantToRead[]> {
      const rows = await db
        .select({ want: wantToRead, edition })
        .from(wantToRead)
        .innerJoin(edition, eq(edition.id, wantToRead.editionId))
        .where(eq(wantToRead.userId, userId))
        .orderBy(desc(wantToRead.createdAt));
      const covers = await borrowedCovers(db, rows.map((r) => r.edition));
      return rows.map((r) => ({ id: r.want.id, edition: withCover(toEdition(r.edition), covers), bookKey: r.want.bookKey, addedAt: r.want.createdAt.toISOString() }));
    },

    /** Save a book for later; saving it again just changes the edition. Not for a book you're reading. */
    async addWant(userId: string, editionId: string): Promise<WantToRead> {
      const [e] = await db.select().from(edition).where(eq(edition.id, editionId));
      if (!e) throw new ReadingError(400, 'unknown_edition');
      const bookKey = bookKeyOf(e);
      const [active] = await db
        .select({ id: reading.id })
        .from(reading)
        .where(and(eq(reading.userId, userId), eq(reading.bookKey, bookKey), eq(reading.status, 'reading')));
      if (active) throw new ReadingError(409, 'already_reading', active.id);
      const [row] = await db
        .insert(wantToRead)
        .values({ id: randomUUID(), userId, editionId: e.id, bookKey })
        .onConflictDoUpdate({ target: [wantToRead.userId, wantToRead.bookKey], set: { editionId: e.id } })
        .returning();
      return { id: row!.id, edition: toEdition(e), bookKey, addedAt: row!.createdAt.toISOString() };
    },

    async removeWant(userId: string, id: string) {
      const gone = await db
        .delete(wantToRead)
        .where(and(eq(wantToRead.id, id), eq(wantToRead.userId, userId)))
        .returning({ id: wantToRead.id });
      if (gone.length === 0) throw new ReadingError(404, 'not_found');
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
      // A new finish-by date starts the rabbit from here and now; clearing it clears that too.
      const target =
        input.targetDate === undefined || input.targetDate === r.targetDate
          ? {}
          : input.targetDate === null
            ? { targetDate: null, targetSetAt: null, targetFrom: null }
            : { targetDate: input.targetDate, targetSetAt: new Date(), targetFrom: r.position };
      await db.update(reading).set({ editionId, startPage, endPage, currentPage, ...target }).where(eq(reading.id, id));
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
      // A log made offline arrives later, with the time it was made: never in the future, never before the
      // reading began. One older than the last log (another device has logged since) joins the history but
      // doesn't move you back.
      const now = Date.now();
      const at = new Date(input.at ? Math.min(now, Math.max(Date.parse(input.at), r.startedAt.getTime())) : now);
      const last = await lastEvent(r.id);
      if (!last || at >= last.createdAt) {
        await db
          .update(reading)
          .set({ position, currentPage: page ?? (position > 0 ? positionToPage(position, range) : null) })
          .where(eq(reading.id, id));
      }
      await record(r, position, page, at);
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
            startPage: r.startPage,
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

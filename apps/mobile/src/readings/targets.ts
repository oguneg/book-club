import { paceAt, pagesPerDay, pageToPosition, POSITION_SCALE, positionToPage, type ClubBook, type Reading } from '@bookclub/shared';
import { pacePlan } from '../clubs/pace';
import { localDay } from './calendar';

// What to read by when, and where the rabbit is: the arithmetic behind "19 pages a day to reach p. 120 by
// Friday" and "12 pages ahead of the rabbit", for a reading on its own or in a club.

type Place = Pick<Reading, 'startPage' | 'endPage' | 'currentPage' | 'position'> & {
  targetDate?: string | null;
  targetSetAt?: string | null;
  targetFrom?: number | null;
  startedAt?: string;
};

export interface ReadingTarget {
  /** Pages a day from today; 0 when you're already there. */
  pages: number;
  /** Days to go, today and the day itself included. */
  days: number;
  /** The page to reach, in your copy. */
  targetPage: number;
  /** YYYY-MM-DD */
  by: string;
  kind: 'meeting' | 'clubFinish' | 'own';
  /** The meeting's title. */
  title?: string;
}

/** Where you are in your copy, as a page (the page before the story when you haven't started). */
const currentPageOf = (r: Place) => r.currentPage ?? (r.position > 0 ? positionToPage(r.position, r) : r.startPage - 1);

/**
 * The nearest thing to read towards: your club's next meeting ("read up to p. N", in your copy's pages), the
 * club's finish date, or your own finish-by date. One you've already reached gives way to the next; when
 * you've reached them all, the nearest says 0 pages ("you're ready").
 */
export function readingTarget(reading: Place, clubBook: ClubBook | null, now: Date): ReadingTarget | null {
  const today = localDay(now);
  const mine = { startPage: reading.startPage, endPage: reading.endPage };
  const candidates: Omit<ReadingTarget, 'pages' | 'days'>[] = [];
  if (clubBook) {
    const clubPages = { startPage: 1, endPage: Math.max(2, clubBook.edition.pageCount ?? 2) };
    for (const m of clubBook.meetings) {
      if (m.readToPage === null || Date.parse(m.startsAt) <= now.getTime()) continue;
      const position = pageToPosition(Math.min(m.readToPage, clubPages.endPage), clubPages);
      candidates.push({ kind: 'meeting', title: m.title, by: localDay(new Date(m.startsAt)), targetPage: positionToPage(position, mine) });
    }
    if (clubBook.finishDate && clubBook.finishDate >= today) candidates.push({ kind: 'clubFinish', by: clubBook.finishDate, targetPage: reading.endPage });
  }
  if (reading.targetDate && reading.targetDate >= today) candidates.push({ kind: 'own', by: reading.targetDate, targetPage: reading.endPage });
  if (candidates.length === 0) return null;

  const current = currentPageOf(reading);
  const sorted = candidates.sort((a, b) => a.by.localeCompare(b.by) || a.targetPage - b.targetPage);
  const next = sorted.find((c) => c.targetPage > current) ?? sorted[0]!;
  const perDay = pagesPerDay({ currentPage: current, targetPage: next.targetPage, today, by: next.by });
  return perDay && { ...next, ...perDay };
}

/**
 * Where the rabbit is today: the club's pace (start, meeting targets, finish), or for a book of your own
 * with a finish-by date, a steady pace from where you were when you set it to the end of that day (so
 * setting a date never starts you off behind). Null when there's no pace.
 */
export function rabbitAt(reading: Place, clubBook: ClubBook | null, now: Date): number | null {
  if (clubBook) {
    const pace = paceAt(now, pacePlan(clubBook));
    if (pace !== null) return pace;
  }
  if (!reading.targetDate) return null;
  const from = reading.targetFrom ?? 0;
  const start = Date.parse(reading.targetSetAt ?? reading.startedAt ?? '');
  const [y, m, d] = reading.targetDate.split('-').map(Number);
  const end = new Date(y!, m! - 1, d! + 1).getTime();
  if (Number.isNaN(start) || end <= start) return null;
  const share = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)));
  return Math.round(from + share * (POSITION_SCALE - from));
}

/** Pages from one position to another, in a copy with these story pages. */
export function pagesBetween(from: number, to: number, range: { startPage: number; endPage: number }): number {
  const pageCount = Math.max(1, range.endPage - range.startPage + 1);
  return Math.round(((to - from) / POSITION_SCALE) * pageCount);
}

/** Pages between you and the rabbit, in your copy: positive ahead, negative behind. */
export function pagesFromRabbit(position: number, rabbit: number, range: { startPage: number; endPage: number }): number {
  return pagesBetween(rabbit, position, range);
}

/** Pages someone moved on today (local time), from their history of positions. */
export function pagesToday(history: readonly { at: string; position: number }[], range: { startPage: number; endPage: number }, now: Date): number {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let before = 0;
  let latest: number | null = null;
  for (const h of [...history].sort((a, b) => a.at.localeCompare(b.at))) {
    if (Date.parse(h.at) < midnight) before = h.position;
    else latest = h.position;
  }
  if (latest === null) return 0;
  return Math.max(0, pagesBetween(before, latest, range));
}

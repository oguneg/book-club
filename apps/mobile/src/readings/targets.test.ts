import { pageToPosition, type ClubBook } from '@bookclub/shared';
import { describe, expect, it } from 'vitest';
import { pagesFromRabbit, pagesToday, rabbitAt, readingTarget } from './targets';

// Saturday 10 October 2026, noon, local time.
const now = new Date(2026, 9, 10, 12, 0);
const at = (day: number, hour = 18, minute = 30) => new Date(2026, 9, day, hour, minute).toISOString();
const club = {
  edition: { pageCount: 320 },
  startDate: '2026-10-01',
  finishDate: '2026-10-31',
  meetings: [
    { id: 'm1', title: 'Riddles in the dark', startsAt: at(16), location: null, readToPage: 120 },
    { id: 'm2', title: 'The Lonely Mountain', startsAt: at(30), location: null, readToPage: 320 },
  ],
} as unknown as ClubBook;
const copy = (currentPage: number | null, endPage = 320, extra: object = {}) => ({
  startPage: 1,
  endPage,
  currentPage,
  position: currentPage ? pageToPosition(currentPage, { startPage: 1, endPage }) : 0,
  ...extra,
});

describe("today's target", () => {
  it("aims at the club's next meeting, spread over the days to go", () => {
    expect(readingTarget(copy(60), club, now)).toEqual({ kind: 'meeting', title: 'Riddles in the dark', by: '2026-10-16', targetPage: 120, pages: 9, days: 7 });
  });

  it('moves on to the next target once one is reached, and says 0 when all are', () => {
    expect(readingTarget(copy(150), club, now)).toMatchObject({ kind: 'meeting', title: 'The Lonely Mountain', targetPage: 320, pages: 9, days: 21 });
    expect(readingTarget(copy(320), club, now)).toMatchObject({ title: 'Riddles in the dark', pages: 0 });
  });

  it("puts the club's page into your copy's pages", () => {
    const target = readingTarget(copy(0, 400), club, now)!;
    expect(target.targetPage).toBeGreaterThanOrEqual(149);
    expect(target.targetPage).toBeLessThanOrEqual(151);
  });

  it('uses your own finish-by date for a book outside a club, and nothing once it has passed', () => {
    expect(readingTarget(copy(100, 300, { targetDate: '2026-10-20' }), null, now)).toEqual({ kind: 'own', by: '2026-10-20', targetPage: 300, pages: 19, days: 11 });
    expect(readingTarget(copy(100, 300, { targetDate: '2026-10-09' }), null, now)).toBeNull();
    expect(readingTarget(copy(100, 300), null, now)).toBeNull();
  });
});

describe('the rabbit', () => {
  it("runs at the club's pace, or steadily towards your own finish-by date", () => {
    const clubRabbit = rabbitAt(copy(60), club, now)!;
    // Between the start (1 Oct) and the first meeting's p. 120 (16 Oct).
    expect(clubRabbit).toBeGreaterThan(0);
    expect(clubRabbit).toBeLessThan(pageToPosition(120, { startPage: 1, endPage: 320 }));

    // Set this morning at 20%: the rabbit starts there, not at the book's first page.
    const own = rabbitAt(copy(60, 300, { targetDate: '2026-10-19', targetSetAt: new Date(2026, 9, 10, 9).toISOString(), targetFrom: 2000 }), null, now)!;
    expect(own).toBeGreaterThan(2000);
    expect(own).toBeLessThan(2200);
    // On the day itself, by its end, the rabbit has finished.
    expect(rabbitAt(copy(60, 300, { targetDate: '2026-10-10', targetSetAt: new Date(2026, 9, 1).toISOString(), targetFrom: 0 }), null, new Date(2026, 9, 10, 23, 59, 59))).toBeGreaterThan(9990);
    expect(rabbitAt(copy(60, 300), null, now)).toBeNull();
  });

  it('says how far ahead or behind you are in your own pages', () => {
    expect(pagesFromRabbit(5000, 4000, { startPage: 1, endPage: 300 })).toBe(30);
    expect(pagesFromRabbit(3000, 4000, { startPage: 1, endPage: 300 })).toBe(-30);
  });
});

describe('pages read today', () => {
  it("counts from where someone was before midnight to their latest log today", () => {
    const history = [
      { at: new Date(2026, 9, 9, 22).toISOString(), position: 2000 },
      { at: new Date(2026, 9, 10, 8).toISOString(), position: 2500 },
      { at: new Date(2026, 9, 10, 11).toISOString(), position: 3000 },
    ];
    expect(pagesToday(history, { startPage: 1, endPage: 300 }, now)).toBe(30);
    expect(pagesToday(history.slice(0, 1), { startPage: 1, endPage: 300 }, now)).toBe(0);
  });
});

import { z } from 'zod';

// Goals a reader can set for themselves, all optional, and the gentle arithmetic around them: a weekly
// streak (weeks with reading on a few days, so a quiet day never breaks it) and "pages a day to get there".

/** A calendar date, YYYY-MM-DD. */
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), 'invalid date');

export const MAX_YEARLY_BOOKS = 500;
export const MAX_DAILY_PAGES = 1000;

export const readingGoals = z.object({
  /** Books to finish this calendar year. */
  yearlyBooks: z.number().int().min(1).max(MAX_YEARLY_BOOKS).nullable(),
  /** Pages to read a day. */
  dailyPages: z.number().int().min(1).max(MAX_DAILY_PAGES).nullable(),
});
export type ReadingGoals = z.infer<typeof readingGoals>;
export const readingGoalsResponse = z.object({ goals: readingGoals });
/** Only the goals given change; null clears one. */
export const updateReadingGoalsInput = readingGoals.partial();

/** A week counts towards the streak with reading on at least this many days. */
export const STREAK_DAYS_PER_WEEK = 3;

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day: string) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);

/** The Monday of a date's week (weeks run Monday to Sunday), as a day number. */
function weekOf(day: string): number {
  const n = dayNumber(day);
  // Day 0 (1 January 1970) was a Thursday.
  return n - ((n + 3) % 7);
}

/** Whole days from one date to another (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from);
}

export interface WeeklyStreak {
  /** Weeks in a row with reading on enough days, up to this one (when it already counts) or last week. */
  weeks: number;
  /** Days with reading so far this week. */
  daysThisWeek: number;
  /** This week already has enough days. */
  thisWeekCounts: boolean;
}

/**
 * The streak from the days someone read (local dates). The week under way never breaks it: until Sunday
 * it can still count, so the streak runs up to last week and this week joins once it has enough days.
 */
export function weeklyStreak(readingDays: readonly string[], today: string): WeeklyStreak {
  const thisWeek = weekOf(today);
  const daysPerWeek = new Map<number, number>();
  for (const day of new Set(readingDays)) {
    if (dayNumber(day) > dayNumber(today)) continue;
    const week = weekOf(day);
    daysPerWeek.set(week, (daysPerWeek.get(week) ?? 0) + 1);
  }
  const counts = (week: number) => (daysPerWeek.get(week) ?? 0) >= STREAK_DAYS_PER_WEEK;
  let weeks = 0;
  for (let week = thisWeek - 7; counts(week); week -= 7) weeks++;
  const daysThisWeek = daysPerWeek.get(thisWeek) ?? 0;
  const thisWeekCounts = counts(thisWeek);
  return { weeks: weeks + (thisWeekCounts ? 1 : 0), daysThisWeek, thisWeekCounts };
}

/**
 * Pages a day to get from `currentPage` to `targetPage` by the end of `by`, starting today (both days
 * included). Null once the day has passed; zero pages when you're already there.
 */
export function pagesPerDay({ currentPage, targetPage, today, by }: { currentPage: number; targetPage: number; today: string; by: string }): { pages: number; days: number } | null {
  const days = daysBetween(today, by) + 1;
  if (days < 1) return null;
  const left = targetPage - currentPage;
  return { pages: left > 0 ? Math.ceil(left / days) : 0, days };
}

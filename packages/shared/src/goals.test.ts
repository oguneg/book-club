import { describe, expect, it } from 'vitest';
import { pagesPerDay, readingGoals, weeklyStreak } from './goals';

// Saturday 10 October 2026; that week runs Monday 5 to Sunday 11 October.
const today = '2026-10-10';

describe('weekly streak', () => {
  it('counts weeks in a row with reading on three or more days', () => {
    const days = [
      // Two weeks ago (21–27 Sep): only two days, so the streak stops before it.
      '2026-09-22', '2026-09-26',
      // 28 Sep – 4 Oct: three days.
      '2026-09-28', '2026-09-30', '2026-10-04',
      // This week: two days so far.
      '2026-10-06', '2026-10-08',
    ];
    expect(weeklyStreak(days, today)).toEqual({ weeks: 1, daysThisWeek: 2, thisWeekCounts: false });
  });

  it('adds this week once it has enough days, and never breaks on the week under way', () => {
    const lastWeek = ['2026-09-29', '2026-10-01', '2026-10-03'];
    expect(weeklyStreak([...lastWeek, '2026-10-05', '2026-10-07', '2026-10-10'], today)).toEqual({ weeks: 2, daysThisWeek: 3, thisWeekCounts: true });
    // Nothing yet this week (it's Monday): still a 1-week streak.
    expect(weeklyStreak(lastWeek, '2026-10-05')).toEqual({ weeks: 1, daysThisWeek: 0, thisWeekCounts: false });
  });

  it('is over after a week without enough days, and ignores repeats and days in the future', () => {
    expect(weeklyStreak(['2026-09-21', '2026-09-22', '2026-09-23'], today).weeks).toBe(0);
    expect(weeklyStreak(['2026-10-06', '2026-10-06', '2026-10-06', '2026-10-11', '2026-10-12'], today)).toMatchObject({ daysThisWeek: 1, thisWeekCounts: false });
  });

  it('treats Sunday as the end of the week', () => {
    expect(weeklyStreak(['2026-10-09', '2026-10-10', '2026-10-11'], '2026-10-11')).toEqual({ weeks: 1, daysThisWeek: 3, thisWeekCounts: true });
  });
});

describe('pages a day', () => {
  it('spreads what is left over the days to go, today and the day itself included', () => {
    expect(pagesPerDay({ currentPage: 188, targetPage: 320, today, by: '2026-10-16' })).toEqual({ pages: 19, days: 7 });
    expect(pagesPerDay({ currentPage: 300, targetPage: 320, today, by: today })).toEqual({ pages: 20, days: 1 });
  });

  it('is zero once you are there, and nothing after the day has passed', () => {
    expect(pagesPerDay({ currentPage: 330, targetPage: 320, today, by: '2026-10-16' })).toEqual({ pages: 0, days: 7 });
    expect(pagesPerDay({ currentPage: 10, targetPage: 320, today, by: '2026-10-09' })).toBeNull();
  });
});

describe('goals', () => {
  it('accepts sensible numbers and clearing', () => {
    expect(readingGoals.safeParse({ yearlyBooks: 24, dailyPages: null }).success).toBe(true);
    expect(readingGoals.safeParse({ yearlyBooks: 0, dailyPages: 20 }).success).toBe(false);
    expect(readingGoals.safeParse({ yearlyBooks: 24, dailyPages: 2.5 }).success).toBe(false);
  });
});

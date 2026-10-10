import type { ReadingStats } from '@bookclub/shared';

/** How many weeks the reading calendar shows. */
export const WEEKS = 12;

/** YYYY-MM-DD in the reader's own time zone. */
export const localDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** How much a day's reading was, as one of four steps (0 = no reading). */
export function dayLevel(pages: number): number {
  if (pages <= 0) return 0;
  if (pages <= 10) return 1;
  if (pages <= 25) return 2;
  if (pages <= 50) return 3;
  return 4;
}

/** Pages per local day, and the 12 weeks of days to draw (Monday-first columns ending with this week). */
export function calendarOf(stats: Pick<ReadingStats, 'recent'>, today: Date) {
  const pages = new Map<string, number>();
  for (const e of stats.recent) {
    const day = localDay(new Date(e.at));
    pages.set(day, (pages.get(day) ?? 0) + e.pages);
  }
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7);
  const weeks: { day: string; date: Date; pages: number; future: boolean }[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + w * 7 + d);
      const day = localDay(date);
      week.push({ day, date, pages: pages.get(day) ?? 0, future: date > today });
    }
    weeks.push(week);
  }
  const lastWeekStart = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const weekPages = [...pages].filter(([day]) => day >= localDay(lastWeekStart)).reduce((sum, [, n]) => sum + n, 0);
  const daysRead = weeks.flat().filter((c) => c.pages > 0);
  return { weeks, weekPages, daysRead, todayPages: pages.get(localDay(today)) ?? 0 };
}

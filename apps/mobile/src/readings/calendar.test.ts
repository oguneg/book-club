import { describe, expect, it } from 'vitest';
import { calendarOf, dayLevel } from './calendar';

describe('reading calendar', () => {
  it('puts a day in one of four steps by pages read', () => {
    expect([0, 1, 10, 11, 25, 26, 50, 51, 400].map(dayLevel)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });

  it('sums each local day, counts the last 7 days, and draws 12 Monday-first weeks ending this week', () => {
    // Saturday 10 October 2026, mid-afternoon local time.
    const today = new Date(2026, 9, 10, 15, 0);
    const at = (d: number, h = 12) => new Date(2026, 9, d, h).toISOString();
    const cal = calendarOf({ recent: [{ at: at(10, 9), pages: 20 }, { at: at(10, 21), pages: 5 }, { at: at(5), pages: 40 }, { at: at(1), pages: 100 }] }, today);
    expect(cal.weeks).toHaveLength(12);
    expect(cal.weeks.every((w) => w.length === 7 && w[0]!.date.getDay() === 1)).toBe(true);
    const last = cal.weeks[11]!;
    expect(last.find((c) => c.date.getDate() === 10)).toMatchObject({ pages: 25, future: false });
    expect(last.find((c) => c.date.getDate() === 11)).toMatchObject({ future: true });
    // The last 7 days (4 to 10 October): 25 + 40, but not the 1st.
    expect(cal.weekPages).toBe(65);
    expect(cal.daysRead.map((c) => c.pages)).toEqual([100, 40, 25]);
  });
});

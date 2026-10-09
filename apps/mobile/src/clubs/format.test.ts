import { describe, expect, it } from 'vitest';
import { localDateTimeToIso, parseLocalDate, toLocalDateString, toLocalTimeString } from './format';

describe('club date helpers', () => {
  it('reads YYYY-MM-DD as a local calendar date', () => {
    const d = parseLocalDate('2026-10-20');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 20, 0]);
    expect(toLocalDateString(d)).toBe('2026-10-20');
  });

  it('turns form date + time into an instant and back', () => {
    const iso = localDateTimeToIso('2026-10-20', '18:30');
    expect(iso).not.toBeNull();
    const back = new Date(iso!);
    expect(toLocalDateString(back)).toBe('2026-10-20');
    expect(toLocalTimeString(back)).toBe('18:30');
  });

  it('rejects incomplete input', () => {
    expect(localDateTimeToIso('2026-10-20', '')).toBeNull();
    expect(localDateTimeToIso('20/10/2026', '18:30')).toBeNull();
  });
});

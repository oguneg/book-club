import { describe, expect, it } from 'vitest';
import { paceAt, pacePoints } from './pace';
import { bookKeyOf } from './reading';

const day = (d: string) => new Date(`${d}T00:00:00Z`);

describe('pace line', () => {
  it('runs straight from start to finish', () => {
    const plan = { startDate: '2026-10-01', finishDate: '2026-10-31', checkpoints: [] };
    expect(paceAt(day('2026-09-20'), plan)).toBe(0);
    expect(paceAt(day('2026-10-01'), plan)).toBe(0);
    expect(paceAt(day('2026-10-16'), plan)).toBe(5000);
    expect(paceAt(day('2026-11-05'), plan)).toBe(10000);
  });

  it('bends through meeting targets', () => {
    const plan = {
      startDate: '2026-10-01',
      finishDate: '2026-10-31',
      checkpoints: [{ at: '2026-10-11T00:00:00Z', position: 2000 }],
    };
    expect(paceAt(day('2026-10-06'), plan)).toBe(1000);
    expect(paceAt(day('2026-10-11'), plan)).toBe(2000);
    expect(paceAt(day('2026-10-21'), plan)).toBe(6000);
  });

  it('works with meeting targets only, then holds', () => {
    const plan = { startDate: '2026-10-01', finishDate: null, checkpoints: [{ at: '2026-10-11T00:00:00Z', position: 4000 }] };
    expect(paceAt(day('2026-10-06'), plan)).toBe(2000);
    expect(paceAt(day('2026-12-01'), plan)).toBe(4000);
  });

  it('has no pace without a finish date or targets', () => {
    expect(paceAt(day('2026-10-06'), { startDate: '2026-10-01', finishDate: null, checkpoints: [] })).toBeNull();
  });

  it('never asks a club to go backwards, and ignores targets outside the reading period', () => {
    const points = pacePoints({
      startDate: '2026-10-01',
      finishDate: '2026-10-31',
      checkpoints: [
        { at: '2026-10-20T00:00:00Z', position: 3000 },
        { at: '2026-10-10T00:00:00Z', position: 5000 },
        { at: '2026-11-10T00:00:00Z', position: 9000 },
      ],
    });
    expect(points.map((p) => p.position)).toEqual([0, 5000, 5000, 10000]);
  });
});

describe('book keys', () => {
  it('groups editions by work, falling back to the edition', () => {
    expect(bookKeyOf({ id: 'e1', workKey: 'OL27482W' })).toBe('w:OL27482W');
    expect(bookKeyOf({ id: 'e1', workKey: null })).toBe('e:e1');
  });
});

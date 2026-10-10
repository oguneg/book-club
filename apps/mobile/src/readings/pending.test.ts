import { describe, expect, it } from 'vitest';
import { addPending, parsePending, withPending, type PendingLog } from './pending';

const at = (minute: number, second = 0) => new Date(Date.UTC(2026, 9, 10, 8, minute, second)).toISOString();
const log = (id: string, readingId: string, when: string, place: { page: number } | { percent: number }): PendingLog => ({ id, readingId, at: when, ...place });

describe('progress waiting on this device', () => {
  it('folds logs for the same book less than a minute apart into the later one, like the server', () => {
    let queue = addPending([], log('a', 'r1', at(0), { page: 50 }));
    queue = addPending(queue, log('b', 'r2', at(0, 20), { page: 10 }));
    queue = addPending(queue, log('c', 'r1', at(0, 40), { page: 60 }));
    expect(queue.map((p) => p.id)).toEqual(['b', 'c']);

    queue = addPending(queue, log('d', 'r1', at(5), { page: 90 }));
    expect(queue.map((p) => p.id)).toEqual(['b', 'c', 'd']);
  });

  it('keeps only stored entries that still make sense', () => {
    const good = log('a', 'r1', at(0), { percent: 40 });
    expect(parsePending([good, { id: 'x' }, null, { ...good, id: 'b', percent: 140 }])).toEqual([good]);
    expect(parsePending('not a list')).toEqual([]);
  });

  it('shows a reading where its waiting logs will put it', () => {
    const reading = { id: 'r1', startPage: 11, endPage: 310, position: 0, currentPage: null, history: [] };
    const placed = withPending(reading, [log('a', 'r1', at(0), { page: 130 }), log('z', 'other', at(1), { page: 5 })]);
    expect(placed).toMatchObject({ position: 4000, currentPage: 130 });
    expect(placed.history).toEqual([{ at: at(0), position: 4000, page: 130 }]);

    expect(withPending(reading, [log('a', 'r1', at(0), { percent: 50 })])).toMatchObject({ position: 5000, currentPage: 160 });
    // Before the story starts (front matter): still at the beginning.
    expect(withPending(reading, [log('a', 'r1', at(0), { page: 3 })])).toMatchObject({ position: 0, currentPage: 3 });
    expect(withPending(reading, [])).toBe(reading);
  });
});

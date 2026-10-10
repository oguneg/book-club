import { pageToPosition, percentToPosition, positionToPage, type ProgressEntry } from '@bookclub/shared';
import { z } from 'zod';

/**
 * Progress logged on this device that hasn't reached the server yet (made offline, or while the server was
 * out of reach). Logging never waits for the network: the log is kept here, shown at once, and sent in order
 * with the time it was made.
 */
export const pendingLog = z.union([
  z.object({ id: z.string(), readingId: z.string(), at: z.string(), page: z.number().int().min(0) }),
  z.object({ id: z.string(), readingId: z.string(), at: z.string(), percent: z.number().min(0).max(100) }),
]);
export type PendingLog = z.infer<typeof pendingLog>;

/** The server folds logs less than a minute apart into one; the queue does the same, keeping the later. */
const MERGE_WINDOW_MS = 60_000;

export function addPending(queue: readonly PendingLog[], log: PendingLog): PendingLog[] {
  const previous = queue.findLast((p) => p.readingId === log.readingId);
  if (previous && Date.parse(log.at) - Date.parse(previous.at) < MERGE_WINDOW_MS) return [...queue.filter((p) => p !== previous), log];
  return [...queue, log];
}

/** A stored queue, keeping only entries that still make sense (the format may change between versions). */
export function parsePending(raw: unknown): PendingLog[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const parsed = pendingLog.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

type Range = { startPage: number; endPage: number };

/** Where a log puts you, worked out the way the server does. */
export function placeOf(log: PendingLog, range: Range): { position: number; currentPage: number | null; page: number | null } {
  if ('page' in log) return { position: log.page < range.startPage ? 0 : pageToPosition(log.page, range), currentPage: log.page, page: log.page };
  const position = percentToPosition(log.percent);
  return { position, currentPage: position > 0 ? positionToPage(position, range) : null, page: null };
}

type Placeable = Range & { id: string; position: number; currentPage: number | null; history?: ProgressEntry[] };

/** A reading as it will be once its waiting logs arrive. */
export function withPending<T extends Placeable>(reading: T, queue: readonly PendingLog[]): T {
  const mine = queue.filter((p) => p.readingId === reading.id);
  if (mine.length === 0) return reading;
  let next: T = reading;
  for (const log of mine) {
    const place = placeOf(log, reading);
    next = {
      ...next,
      position: place.position,
      currentPage: place.currentPage,
      ...(next.history ? { history: [...next.history, { at: log.at, position: place.position, page: place.page }] } : {}),
    };
  }
  return next;
}

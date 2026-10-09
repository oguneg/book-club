import { POSITION_SCALE } from './position';

// The pace line: where a club should be on a given day. It runs from the start date (position 0) through
// each meeting's "read up to" target to the finish date (the end of the book), straight between points.

export interface PaceCheckpoint {
  /** ISO date-time of the meeting. */
  at: string;
  position: number;
}

export interface PacePlan {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD, or null when the club didn't set one. */
  finishDate: string | null;
  checkpoints: PaceCheckpoint[];
}

const dayStart = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** The points the pace line passes through, in time order and never going backwards. Empty = no pace. */
export function pacePoints({ startDate, finishDate, checkpoints }: PacePlan): { t: number; position: number }[] {
  const start = dayStart(startDate);
  const end = finishDate ? dayStart(finishDate) : null;
  const inside = checkpoints
    .map((c) => ({ t: Date.parse(c.at), position: c.position }))
    .filter((c) => c.t > start && (end === null || c.t < end))
    .sort((a, b) => a.t - b.t);
  if (end === null && inside.length === 0) return [];

  const points = [{ t: start, position: 0 }];
  for (const c of inside) points.push({ t: c.t, position: Math.max(c.position, points[points.length - 1]!.position) });
  if (end !== null && end > start) points.push({ t: end, position: POSITION_SCALE });
  return points;
}

/** Where the club should be at `at`, or null when there is no pace (no finish date and no meeting targets). */
export function paceAt(at: Date | number, plan: PacePlan): number | null {
  const points = pacePoints(plan);
  if (points.length < 2) return null;
  const t = typeof at === 'number' ? at : at.getTime();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (t <= first.t) return first.position;
  if (t >= last.t) return last.position;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (t <= b.t) return Math.round(a.position + ((t - a.t) / (b.t - a.t)) * (b.position - a.position));
  }
  return last.position;
}

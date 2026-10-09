import { POSITION_SCALE } from '@bookclub/shared';
import type { TFunction } from 'i18next';

export interface LineMember {
  userId: string;
  name: string;
  /** 0..10000, or null when they haven't started. */
  position: number | null;
  me: boolean;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * Where everyone else is, in words and in your own pages: "Sam ≈26 pages ahead · Lena ≈117 behind".
 * Before you've started, their percentages instead.
 */
export function whereEveryoneIs(t: TFunction, others: LineMember[], mine: number | null, span: number): string {
  const sorted = [...others].sort((a, b) => (b.position ?? -1) - (a.position ?? -1));
  const parts = sorted.slice(0, 4).map((m) => {
    const name = firstName(m.name);
    if (m.position === null) return t('notes.line.notStarted', { name });
    if (mine === null) return t('notes.line.percent', { name, percent: Math.round((m.position / POSITION_SCALE) * 100) });
    const pages = Math.round((Math.abs(m.position - mine) / POSITION_SCALE) * span);
    if (pages < 2) return t('notes.line.withYou', { name });
    return t(m.position > mine ? 'notes.line.ahead' : 'notes.line.behind', { name, count: pages });
  });
  if (sorted.length > 4) parts.push(t('notes.line.more', { count: sorted.length - 4 }));
  return parts.join(' · ');
}

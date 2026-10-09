import { positionToPercent, type Reading } from '@bookclub/shared';
import type { TFunction } from 'i18next';

export function percentLabel(position: number): number {
  return Math.round(positionToPercent(position));
}

/** "Page 120 of 300 · 40%", "Finished", "Not started"… */
export function readingLine(t: TFunction, r: Pick<Reading, 'status' | 'position' | 'currentPage' | 'endPage'>): string {
  if (r.status === 'finished') return t('reading.finished');
  const percent = percentLabel(r.position);
  const progress = r.currentPage
    ? t('reading.progressLine', { page: r.currentPage, end: r.endPage, percent })
    : r.position > 0
      ? t('reading.progressPercent', { percent })
      : t('reading.notStarted');
  return r.status === 'stopped' ? `${t('reading.stopped')} · ${progress}` : progress;
}

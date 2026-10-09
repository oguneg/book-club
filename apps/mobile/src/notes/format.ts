import { notePlace, type Note, type NoteViewer } from '@bookclub/shared';
import type { TFunction } from 'i18next';
import { formatDate } from '@/clubs/format';

/** "p. 120" in the viewer's own copy, "≈ p. 160" mapped from another edition, or "40%" for non-readers. */
export function placeLabel(t: TFunction, n: Pick<Note, 'position' | 'page' | 'editionId'>, viewer: NoteViewer | null): string {
  const place = notePlace(n, viewer);
  if (place.page === null) return t('notes.placePercent', { percent: place.percent });
  return place.approximate ? t('notes.placeApprox', { page: place.page }) : t('notes.place', { page: place.page });
}

/** "just now", "5 min ago", "3 h ago", "2 d ago", then the date. */
export function noteTime(t: TFunction, iso: string, now: number): string {
  const minutes = Math.floor((now - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t('notes.justNow');
  if (minutes < 60) return t('notes.minutesAgo', { count: minutes });
  if (minutes < 24 * 60) return t('notes.hoursAgo', { count: Math.floor(minutes / 60) });
  if (minutes < 7 * 24 * 60) return t('notes.daysAgo', { count: Math.floor(minutes / (24 * 60)) });
  return formatDate(iso.slice(0, 10));
}

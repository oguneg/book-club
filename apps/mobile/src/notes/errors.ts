import i18n, { type TFunction } from 'i18next';
import { ApiError } from '@/api/client';
import { readingErrorMessage } from '@/readings/errors';

export function noteErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code) {
    const key = `notes.errors.${error.code}`;
    if (i18n.exists(key)) return t(key as 'notes.errors.not_found');
  }
  return readingErrorMessage(t, error);
}

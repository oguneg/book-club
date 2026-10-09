import i18n, { type TFunction } from 'i18next';
import { ApiError } from '@/api/client';
import { clubErrorMessage } from '@/clubs/errors';

export function readingErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code) {
    const key = `reading.errors.${error.code}`;
    if (i18n.exists(key)) return t(key as 'reading.errors.not_reading');
  }
  return clubErrorMessage(t, error);
}

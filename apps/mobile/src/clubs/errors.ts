import i18n, { type TFunction } from 'i18next';
import { ApiError } from '@/api/client';
import { bookErrorMessage } from '@/books/errors';

/** A sentence for a failed club request: the server's error code when we have words for it. */
export function clubErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError && error.code) {
    const key = `clubs.errors.${error.code}`;
    if (i18n.exists(key)) return t(key as 'clubs.errors.not_found');
  }
  return bookErrorMessage(t, error);
}

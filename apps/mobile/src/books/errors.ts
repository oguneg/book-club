import type { TFunction } from 'i18next';
import { ApiError } from '@/api/client';

/** A sentence for a failed book request. */
export function bookErrorMessage(t: TFunction, error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 502) return t('books.providerDown');
    if (error.status === 429) return t('books.rateLimited');
    if (error.code === 'invalid_isbn') return t('books.isbnInvalid');
  }
  if (error instanceof TypeError) return t('auth.errors.network');
  return t('auth.errors.generic');
}

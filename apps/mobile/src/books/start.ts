import type { Edition } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { ApiError } from '@/api/client';
import { startReading } from '@/api/readings';
import { preferredLanguages, sortByLanguage, typicalEdition } from '@/books/format';

/**
 * The edition to use when the reader doesn't say: in their language, of a typical length (see
 * typicalEdition). Most readers never need to pick; "Different edition?" is there for the ones who do.
 */
export function pickEdition<T extends Pick<Edition, 'language' | 'pageCount'>>(editions: T[]): T | undefined {
  return typicalEdition(sortByLanguage(editions, preferredLanguages(getLocales().map((l) => l.languageCode))));
}

/**
 * "Start reading" in one step: with a known page count the reading starts right away (story from page 1
 * to the last; adjustable later). Without one, the reader is asked for their copy's pages. Reading a book
 * you've already started opens that reading instead.
 */
export function useStartReading() {
  const queryClient = useQueryClient();
  return async (edition: Pick<Edition, 'id' | 'pageCount'>, clubId?: string | null) => {
    if (!edition.pageCount) {
      router.push({ pathname: '/readings/new', params: { editionId: edition.id, ...(clubId ? { club: clubId } : {}) } });
      return;
    }
    try {
      await startReading({ editionId: edition.id, startPage: 1, endPage: edition.pageCount });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_reading' && typeof err.details.readingId === 'string') {
        router.dismissTo({ pathname: '/readings/[id]', params: { id: err.details.readingId } });
        return;
      }
      throw err;
    }
    await queryClient.invalidateQueries({ queryKey: ['readings'] });
    // Starting a book takes it off "Want to read".
    void queryClient.invalidateQueries({ queryKey: ['want-to-read'] });
    if (clubId) {
      await queryClient.invalidateQueries({ queryKey: ['club-progress', clubId] });
      router.dismissTo({ pathname: '/clubs/[id]', params: { id: clubId } });
    } else {
      // My books opens on what you're reading, this one included.
      router.dismissTo('/');
    }
  };
}

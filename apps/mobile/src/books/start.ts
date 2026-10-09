import type { Edition } from '@bookclub/shared';
import { useQueryClient } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { ApiError } from '@/api/client';
import { useClubActions } from '@/api/clubs';
import { startReading } from '@/api/readings';
import { preferredLanguages, sortByLanguage, typicalEdition } from '@/books/format';

/**
 * The edition to use when the reader doesn't say: in their language, of a typical length (see
 * typicalEdition). Most readers never need to pick; "Different edition?" is there for the ones who do.
 */
export function pickEdition<T extends Pick<Edition, 'title' | 'language' | 'pageCount'>>(editions: T[]): T | undefined {
  return typicalEdition(sortByLanguage(editions, preferredLanguages(getLocales().map((l) => l.languageCode))));
}

/** Opens a reading on its own page, asking "Where are you?" right away (`open: 'update'`) or with a note to write. */
export function openReading(id: string, open?: 'update' | 'note') {
  if (router.canDismiss()) router.dismissAll();
  router.push({ pathname: '/readings/[id]', params: { id, ...(open ? { open } : {}) } });
}

/**
 * "Start reading" in one step: with a known page count the reading starts right away (story from page 1
 * to the last; adjustable later) and opens on "Where are you?", since plenty of people start a book they
 * already have going. Without a page count the reader is asked for their copy's pages. Reading a book
 * you've already started opens that reading instead.
 */
export function useStartReading() {
  const queryClient = useQueryClient();
  return async (edition: Pick<Edition, 'id' | 'pageCount'>, clubId?: string | null) => {
    if (!edition.pageCount) {
      router.push({ pathname: '/readings/new', params: { editionId: edition.id, ...(clubId ? { club: clubId } : {}) } });
      return;
    }
    let id: string;
    try {
      id = (await startReading({ editionId: edition.id, startPage: 1, endPage: edition.pageCount })).id;
    } catch (err) {
      if (err instanceof ApiError && err.code === 'already_reading' && typeof err.details.readingId === 'string') {
        openReading(err.details.readingId);
        return;
      }
      throw err;
    }
    await queryClient.invalidateQueries({ queryKey: ['readings'] });
    // Starting a book takes it off "Want to read".
    void queryClient.invalidateQueries({ queryKey: ['want-to-read'] });
    if (clubId) void queryClient.invalidateQueries({ queryKey: ['club-progress', clubId] });
    openReading(id, 'update');
  };
}

/**
 * Make an edition the club's book. Whoever chooses it starts reading it too, so they're on the line with
 * everyone from the start. During a new club's setup, back to the setup for its next step.
 */
export function useChooseForClub(clubId: string) {
  const queryClient = useQueryClient();
  const actions = useClubActions(clubId);
  return async (edition: Pick<Edition, 'id' | 'pageCount'>, { setup = false }: { setup?: boolean } = {}) => {
    await actions.setBook({ editionId: edition.id });
    if (edition.pageCount) {
      // Best effort: the club's book is set either way, and the club page still offers "Start reading".
      await startReading({ editionId: edition.id, startPage: 1, endPage: edition.pageCount }).catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['readings'] });
      void queryClient.invalidateQueries({ queryKey: ['want-to-read'] });
      void queryClient.invalidateQueries({ queryKey: ['club-progress', clubId] });
    }
    router.dismissTo(setup ? { pathname: '/clubs/[id]/setup', params: { id: clubId } } : { pathname: '/clubs/[id]', params: { id: clubId } });
  };
}

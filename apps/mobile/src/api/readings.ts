import { clubProgressResponse, readingListResponse, readingResponse, wantToReadListResponse, wantToReadResponse, type ReadingDetail } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export function useReadings() {
  return useQuery({
    queryKey: ['readings'],
    queryFn: async ({ signal }) => (await apiGet('/api/readings', readingListResponse, signal)).readings,
  });
}

export function useReading(id: string) {
  return useQuery({
    queryKey: ['reading', id],
    queryFn: async ({ signal }) => (await apiGet(`/api/readings/${encodeURIComponent(id)}`, readingResponse, signal)).reading,
  });
}

export function useClubProgress(clubId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['club-progress', clubId],
    queryFn: async ({ signal }) => (await apiGet(`/api/clubs/${encodeURIComponent(clubId)}/progress`, clubProgressResponse, signal)).members,
    enabled,
  });
}

/** Books saved for later, newest first. */
export function useWantToRead() {
  return useQuery({
    queryKey: ['want-to-read'],
    queryFn: async ({ signal }) => (await apiGet('/api/want-to-read', wantToReadListResponse, signal)).books,
  });
}

export function useWantToReadActions() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['want-to-read'] });
  return {
    add: async (editionId: string) => {
      const { book } = await apiPost('/api/want-to-read', { editionId }, wantToReadResponse);
      await refresh();
      return book;
    },
    remove: async (id: string) => {
      await apiDelete(`/api/want-to-read/${encodeURIComponent(id)}`, z.undefined());
      await refresh();
    },
  };
}

export async function startReading(input: { editionId: string; startPage: number; endPage: number }) {
  return (await apiPost('/api/readings', input, readingResponse)).reading;
}

/** Reading changes: the returned reading replaces the cached copy; lists and club charts refresh. */
export function useReadingActions(id: string) {
  const queryClient = useQueryClient();
  const base = `/api/readings/${encodeURIComponent(id)}`;
  const store = async (updated: Promise<{ reading: ReadingDetail }>) => {
    const { reading } = await updated;
    queryClient.setQueryData(['reading', id], reading);
    void queryClient.invalidateQueries({ queryKey: ['readings'] });
    void queryClient.invalidateQueries({ queryKey: ['club-progress'] });
    // Your place decides which notes are spoilers.
    void queryClient.invalidateQueries({ queryKey: ['notes'] });
    return reading;
  };
  return {
    logPage: (page: number) => store(apiPost(`${base}/progress`, { page }, readingResponse)),
    logPercent: (percent: number) => store(apiPost(`${base}/progress`, { percent }, readingResponse)),
    finish: () => store(apiPost(`${base}/finish`, {}, readingResponse)),
    stop: () => store(apiPost(`${base}/stop`, {}, readingResponse)),
    resume: () => store(apiPost(`${base}/resume`, {}, readingResponse)),
    setRange: (startPage: number, endPage: number) => store(apiPatch(base, { startPage, endPage }, readingResponse)),
    remove: async () => {
      await apiDelete(base, z.undefined());
      queryClient.removeQueries({ queryKey: ['reading', id] });
      await queryClient.invalidateQueries({ queryKey: ['readings'] });
      void queryClient.invalidateQueries({ queryKey: ['club-progress'] });
    },
  };
}

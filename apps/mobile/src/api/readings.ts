import { clubProgressResponse, readingListResponse, readingResponse, readingStatsResponse, wantToReadListResponse, wantToReadResponse, type Reading, type ReadingDetail } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { z } from 'zod';
import { withPending } from '@/readings/pending';
import { logProgress, syncProgress, useProgressSync } from '@/readings/sync';
import { apiDelete, apiGet, apiPatch, apiPost } from './client';

// Readings are shown with any progress still waiting on this device already applied, so a log made offline
// moves the bar at once and a refresh from the server doesn't jump it back.

export function useReadings() {
  const { pending } = useProgressSync();
  const select = useCallback((readings: Reading[]) => (pending.length === 0 ? readings : readings.map((r) => withPending(r, pending))), [pending]);
  return useQuery({
    queryKey: ['readings'],
    queryFn: async ({ signal }) => (await apiGet('/api/readings', readingListResponse, signal)).readings,
    select,
  });
}

export function useReading(id: string) {
  const { pending } = useProgressSync();
  const select = useCallback((reading: ReadingDetail) => withPending(reading, pending), [pending]);
  return useQuery({
    queryKey: ['reading', id],
    queryFn: async ({ signal }) => (await apiGet(`/api/readings/${encodeURIComponent(id)}`, readingResponse, signal)).reading,
    select,
  });
}

export function useClubProgress(clubId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['club-progress', clubId],
    queryFn: async ({ signal }) => (await apiGet(`/api/clubs/${encodeURIComponent(clubId)}/progress`, clubProgressResponse, signal)).members,
    enabled,
  });
}

/** Your reading, gently counted (see the server's stats). */
export function useReadingStats() {
  return useQuery({
    queryKey: ['reading-stats'],
    queryFn: async ({ signal }) => (await apiGet('/api/reading-stats', readingStatsResponse, signal)).stats,
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
  const store = async (request: () => Promise<{ reading: ReadingDetail }>) => {
    // Progress still waiting goes first, so the server sees things in the order they happened.
    await syncProgress();
    const { reading } = await request();
    queryClient.setQueryData(['reading', id], reading);
    void queryClient.invalidateQueries({ queryKey: ['readings'] });
    void queryClient.invalidateQueries({ queryKey: ['club-progress'] });
    // Your place decides which notes are spoilers.
    void queryClient.invalidateQueries({ queryKey: ['notes'] });
    void queryClient.invalidateQueries({ queryKey: ['reading-stats'] });
    return reading;
  };
  return {
    /** "saved", or "waiting" when it's kept on this device until the server can be reached. */
    logPage: (page: number) => logProgress(id, { page }),
    logPercent: (percent: number) => logProgress(id, { percent }),
    finish: () => store(() => apiPost(`${base}/finish`, {}, readingResponse)),
    stop: () => store(() => apiPost(`${base}/stop`, {}, readingResponse)),
    resume: () => store(() => apiPost(`${base}/resume`, {}, readingResponse)),
    setRange: (startPage: number, endPage: number) => store(() => apiPatch(base, { startPage, endPage }, readingResponse)),
    remove: async () => {
      await apiDelete(base, z.undefined());
      queryClient.removeQueries({ queryKey: ['reading', id] });
      await queryClient.invalidateQueries({ queryKey: ['readings'] });
      void queryClient.invalidateQueries({ queryKey: ['club-progress'] });
    },
  };
}

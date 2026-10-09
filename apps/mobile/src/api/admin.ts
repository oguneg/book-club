import { reportQueueResponse } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { apiGet, apiPost } from './client';

/** Whether the signed-in user reviews reported notes. The admin API answers 404 to everyone else. */
export function useIsModerator() {
  const query = useQuery({
    queryKey: ['moderator'],
    queryFn: ({ signal }) => apiGet('/api/admin', z.object({ moderator: z.literal(true) }), signal),
    retry: false,
    staleTime: Infinity,
  });
  return query.data?.moderator === true;
}

export function useReportQueue() {
  return useQuery({
    queryKey: ['report-queue'],
    queryFn: async ({ signal }) => (await apiGet('/api/admin/reports', reportQueueResponse, signal)).notes,
  });
}

/** Keep a reported note (dismiss its reports) or remove it. Readers' note lists refresh too. */
export function useModerationActions() {
  const queryClient = useQueryClient();
  const act = (action: 'dismiss' | 'remove') => async (noteId: string) => {
    await apiPost(`/api/admin/reports/${encodeURIComponent(noteId)}/${action}`, {}, z.undefined());
    await Promise.all([queryClient.invalidateQueries({ queryKey: ['report-queue'] }), queryClient.invalidateQueries({ queryKey: ['notes'] })]);
  };
  return { keep: act('dismiss'), remove: act('remove') };
}

import { activityResponse } from '@bookclub/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

/** What happened lately in your clubs, newest first (see the server's ActivityService). */
export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: async ({ signal }) => (await apiGet('/api/activity', activityResponse, signal)).items,
  });
}

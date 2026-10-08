import { publicConfig } from '@bookclub/shared';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from './client';

/** Server features the app adapts to (e.g. whether Google sign-in is offered). */
export function usePublicConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: ({ signal }) => apiGet('/api/config', publicConfig, signal),
    staleTime: Infinity,
  });
}

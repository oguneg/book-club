import { readingGoalsResponse, type ReadingGoals } from '@bookclub/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from './client';

/** Your own goals (books this year, pages a day), each optional. */
export function useReadingGoals() {
  return useQuery({
    queryKey: ['reading-goals'],
    queryFn: async ({ signal }) => (await apiGet('/api/reading-goals', readingGoalsResponse, signal)).goals,
  });
}

/** Sets the goals given (null clears one). */
export function useSetReadingGoals() {
  const queryClient = useQueryClient();
  return async (goals: Partial<ReadingGoals>) => {
    const { goals: saved } = await apiPut('/api/reading-goals', goals, readingGoalsResponse);
    queryClient.setQueryData(['reading-goals'], saved);
    return saved;
  };
}

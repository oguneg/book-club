import { bookSearchResponse, editionResponse, workEditionsResponse, type ManualEditionInput } from '@bookclub/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet, apiPost } from './client';

/** Title/author search on Open Library (through our cache). */
export function useBookSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: ['books', 'search', q.toLowerCase()],
    queryFn: ({ signal }) => apiGet(`/api/books/search?q=${encodeURIComponent(q)}`, bookSearchResponse, signal),
    enabled: q.length >= 2,
    staleTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

/** Books people are reading this week (well-known ones with covers), for an empty shelf to start from. */
export function usePopularBooks({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['popular'],
    queryFn: async ({ signal }) => (await apiGet('/api/books/popular', bookSearchResponse, signal)).works,
    enabled,
    staleTime: 60 * 60 * 1000,
  });
}

export function useWork(key: string) {
  return useQuery({
    queryKey: ['books', 'work', key],
    queryFn: ({ signal }) => apiGet(`/api/books/works/${encodeURIComponent(key)}`, workEditionsResponse, signal),
    staleTime: 10 * 60 * 1000,
  });
}

export function useEdition(id: string) {
  return useQuery({
    queryKey: ['books', 'edition', id],
    queryFn: ({ signal }) => apiGet(`/api/books/editions/${encodeURIComponent(id)}`, editionResponse, signal),
    staleTime: 10 * 60 * 1000,
  });
}

export async function lookupIsbn(isbn: string) {
  return (await apiGet(`/api/books/isbn/${encodeURIComponent(isbn)}`, editionResponse)).edition;
}

export async function createManualEdition(input: ManualEditionInput) {
  return (await apiPost('/api/books/editions', input, editionResponse)).edition;
}

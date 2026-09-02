import { apiRequest } from '@/api/client';
import type { SearchResponse } from '@/features/search/types';

export const searchApi = {
  search: (query: string, signal?: AbortSignal) =>
    apiRequest<SearchResponse>(`/search?q=${encodeURIComponent(query)}`, {
      authenticated: true,
      signal,
    }),
};

import { apiRequest } from '@/api/client';
import type { PlaceSelection } from '@/features/places/types';

export const placeApi = {
  search: (query: string, signal?: AbortSignal) =>
    apiRequest<PlaceSelection[]>(`/places/search?q=${encodeURIComponent(query)}`, {
      authenticated: true,
      signal,
    }),
};

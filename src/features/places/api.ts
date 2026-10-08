import { apiRequest } from '@/api/client';
import type { PlaceSelection } from '@/features/places/types';

export const placeApi = {
  areas: (query: string) => apiRequest<PlaceSelection[]>(`/places/areas?q=${encodeURIComponent(query)}`, { authenticated: true }),
  search: (query: string, signal?: AbortSignal) =>
    apiRequest<PlaceSelection[]>(`/places/search?q=${encodeURIComponent(query)}`, {
      authenticated: true,
      signal,
    }),
};

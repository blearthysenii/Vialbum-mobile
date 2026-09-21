import { apiRequest } from '@/api/client';
import type { DiscoverPage, PublicJourneyDetail } from './types';

export const discoverApi = {
  page: (cursor: string | null = null, signal?: AbortSignal) => {
    const query = new URLSearchParams({ limit: '20' });
    if (cursor) query.set('cursor', cursor);
    return apiRequest<DiscoverPage>(`/discover/journeys?${query}`, { authenticated: true, signal });
  },
  detail: (id: string, signal?: AbortSignal) =>
    apiRequest<PublicJourneyDetail>(`/discover/journeys/${encodeURIComponent(id)}`, { authenticated: true, signal }),
};

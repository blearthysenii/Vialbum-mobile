import { apiRequest } from '@/api/client';
import type { DiscoverPage } from '@/features/discover/types';

export const savedJourneysApi = {
  page: (cursor: string | null, signal: AbortSignal) => apiRequest<DiscoverPage>(
    `/saved/journeys?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`,
    { authenticated: true, signal },
  ),
  set: (id: string, saved: boolean) => apiRequest<void>(`/journeys/${encodeURIComponent(id)}/save`, {
    method: saved ? 'POST' : 'DELETE', authenticated: true,
  }),
};

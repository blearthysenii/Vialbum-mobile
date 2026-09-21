import { apiRequest } from '@/api/client';
import type { DiscoverPage, PublicCreator } from '@/features/discover/types';

export type PublicProfile = PublicCreator & {
  first_name: string; last_name: string; bio: string | null; location: string | null;
  public_journeys_count: number;
  cover_url: string | null; is_following: boolean;
};
export const publicProfileApi = {
  get: (id: string, signal: AbortSignal) => apiRequest<PublicProfile>(`/users/${encodeURIComponent(id)}/public-profile`, { authenticated: true, signal }),
  journeys: (id: string, cursor: string | null, signal: AbortSignal) => apiRequest<DiscoverPage>(
    `/users/${encodeURIComponent(id)}/public-journeys?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`,
    { authenticated: true, signal },
  ),
};

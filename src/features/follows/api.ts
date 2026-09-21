import { apiRequest } from '@/api/client';
import type { PublicCreator, DiscoverPage } from '@/features/discover/types';
export type FollowUser = PublicCreator & { is_following: boolean };
export type FollowPage = { items: FollowUser[]; next_cursor: string | null };
export type FollowStats = { followers_count: number; following_count: number };
export const followsApi = {
  set: (id: string, following: boolean) => apiRequest<void>(`/users/${encodeURIComponent(id)}/follow`, { authenticated: true, method: following ? 'POST' : 'DELETE' }),
  stats: (signal: AbortSignal) => apiRequest<FollowStats>('/users/me/follow-stats', { authenticated: true, signal }),
  people: (kind: 'followers' | 'following', cursor: string | null, signal: AbortSignal) => apiRequest<FollowPage>(`/users/me/${kind}?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  feed: (cursor: string | null, signal: AbortSignal) => apiRequest<DiscoverPage>(`/following/journeys?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
};

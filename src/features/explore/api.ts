import { apiRequest } from '@/api/client';
import type { DiscoverJourney, DiscoverPage } from '@/features/discover/types';
import type { FollowUser } from '@/features/follows/api';
import type { Place } from '@/features/places/types';

export type PublicPlace = Pick<Place, 'id' | 'name' | 'display_name' | 'locality' | 'region' | 'country' | 'country_code' | 'latitude' | 'longitude'> & { public_journeys_count: number };
export type Category = 'users' | 'journeys' | 'places';
export type Page<T> = { items: T[]; next_cursor: string | null };
export type SearchResults = { query: string; users: Page<FollowUser>; journeys: Page<DiscoverJourney>; places: Page<PublicPlace> };
export type PlaceResults = { place: PublicPlace; journeys: DiscoverPage };
export const exploreApi = {
  search: (query: string, type: Category | 'all', cursor: string | null, signal: AbortSignal) => apiRequest<SearchResults>(`/explore/search?${new URLSearchParams({ q: query, type, limit: '10', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  place: (id: string, cursor: string | null, signal: AbortSignal) => apiRequest<PlaceResults>(`/explore/places/${encodeURIComponent(id)}?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
};

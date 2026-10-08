import { apiRequest } from '@/api/client';
import type { DiscoverJourney, DiscoverPage } from '@/features/discover/types';
import type { FollowUser } from '@/features/follows/api';
import type { Stay } from '@/features/stays/api';
import type { Place } from '@/features/places/types';

export type PublicPlace = Pick<Place, 'id' | 'name' | 'display_name' | 'locality' | 'region' | 'country' | 'country_code' | 'latitude' | 'longitude'> & { public_journeys_count: number; cover_url?: string | null };
export type Category = 'users' | 'journeys' | 'places' | 'stays' | 'moments';
export type Page<T> = { items: T[]; next_cursor: string | null };
export type SearchResults = { query: string; users: Page<FollowUser>; journeys: Page<DiscoverJourney>; places: Page<PublicPlace>; stays: Page<Stay>; moments: Page<MomentPreview> };
export type PlaceResults = { place: PublicPlace; journeys: DiscoverPage };
export type MomentPreview = { id: string; cover_url: string | null; caption: string | null; creator: { id: string; username: string; display_name: string; avatar_url: string | null } };
export type DestinationTab = 'overview' | 'journeys' | 'stays' | 'moments';
export type DestinationResults = { place: PublicPlace; journeys: Page<DiscoverJourney>; stays: Page<Stay>; moments: Page<MomentPreview> };
export const exploreApi = {
  search: async (query: string, type: Category | 'all', cursor: string | null, signal: AbortSignal) => {
    if (!query.trim() && type !== 'places') return apiRequest<SearchResults>(`/explore/search?${new URLSearchParams({ type, limit: '10', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal });
    if (type === 'places') return { query, users: { items: [], next_cursor: null }, journeys: { items: [], next_cursor: null }, stays: { items: [], next_cursor: null }, moments: { items: [], next_cursor: null }, places: await exploreApi.destinations(query.replace(/^@/, ''), cursor, signal) };
    const [results, places] = await Promise.all([
      apiRequest<SearchResults>(`/explore/search?${new URLSearchParams({ ...(query.trim() ? { q: query } : {}), type, limit: '10', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
      type === 'all' ? exploreApi.destinations(query.replace(/^@/, ''), cursor, signal) : Promise.resolve(null),
    ]);
    return places ? { ...results, places } : results;
  },
  destinations: (q = '', cursor: string | null = null, signal?: AbortSignal) => apiRequest<Page<PublicPlace>>(`/explore/destinations?${new URLSearchParams({ q, limit: '12', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  destination: (id: string, type: DestinationTab, cursor: string | null, signal: AbortSignal) => apiRequest<DestinationResults>(`/explore/destinations/${encodeURIComponent(id)}?${new URLSearchParams({ type, limit: '12', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  place: (id: string, cursor: string | null, signal: AbortSignal) => apiRequest<PlaceResults>(`/explore/places/${encodeURIComponent(id)}?${new URLSearchParams({ limit: '20', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
};

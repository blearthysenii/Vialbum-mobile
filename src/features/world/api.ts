import { apiRequest } from '@/api/client';
import type { MapRegion } from '@/features/map/types';
import { viewportFor } from './viewport';

export type WorldMode = 'explore' | 'own';
export type WorldPhoto = { id: string; journey_id: string; memory_id: string | null; latitude: number; longitude: number; thumbnail_url: string | null; display_name: string; place_name: string };
export type WorldPhotos = { items: WorldPhoto[]; truncated: boolean };
export type Bounds = { north: number; south: number; east: number; west: number };
export type WorldMarker = { id: string; type: 'place' | 'cluster'; place_id: string | null; name: string | null; country: string | null; latitude: number; longitude: number; place_count: number; journey_count: number; bounds: Bounds };
export type WorldData = { items: WorldMarker[]; truncated: boolean; next_cursor: string | null; stats?: { journeys: number; countries: number; cities: number; places: number }; countries?: { code: string; name: string; places: number }[]; bounds?: Bounds | null };
export type OwnPlace = { id: string; name: string; locality: string | null; country: string; journey_count: number; journeys: { id: string; title: string; start_date: string; end_date: string; cover_url: string | null }[]; next_cursor: string | null };
export const worldApi = {
  photos: (region: MapRegion, signal: AbortSignal) => apiRequest<WorldPhotos>(`/users/me/world/photos?${new URLSearchParams(Object.entries({ ...viewportFor(region), limit: 150 }).map(([key, value]) => [key, String(value)]))}`, { authenticated: true, signal }),
  map: (mode: WorldMode, region: MapRegion, signal: AbortSignal) => apiRequest<WorldData>(`${mode === 'own' ? '/users/me/world' : '/explore/map'}?${new URLSearchParams(Object.entries(viewportFor(region)).map(([key, value]) => [key, String(value)]))}`, { authenticated: true, signal }),
  members: (mode: WorldMode, bounds: Bounds, cursor: string | null, signal: AbortSignal) => apiRequest<WorldData>(`${mode === 'own' ? '/users/me/world' : '/explore/map'}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, String(value)])), zoom: '20', grouped: 'false', limit: '20', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  place: (id: string, cursor: string | null, signal: AbortSignal) => apiRequest<OwnPlace>(`/users/me/world/places/${encodeURIComponent(id)}?${new URLSearchParams({ limit: '10', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
};

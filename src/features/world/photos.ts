import type { MapRegion } from '@/features/map/types';
import type { WorldPhoto, WorldPhotos } from './api';
import { viewportFor } from './viewport';

export function photoLevel(region: MapRegion, previous: boolean) {
  return viewportFor(region).zoom >= (previous ? 9.5 : 10);
}
export function placeRegion(place: { latitude: number; longitude: number }): MapRegion {
  return { latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 };
}
export function photoTarget(photo: WorldPhoto) {
  return `/journey/${photo.journey_id}/photo/${photo.id}` as const;
}
export function groupPhotos(photos: WorldPhoto[], region: MapRegion) {
  const cell = Math.max(0.000001, region.longitudeDelta / 7);
  const groups = new Map<string, WorldPhoto[]>();
  for (const photo of photos) {
    const key = `${Math.floor(photo.latitude / cell)}:${Math.floor(photo.longitude / cell)}`;
    groups.set(key, [...(groups.get(key) ?? []), photo]);
  }
  return [...groups.values()];
}
export function createPhotoStore(fetcher: (region: MapRegion, signal: AbortSignal) => Promise<WorldPhotos>) {
  let state = { items: [] as WorldPhoto[], truncated: false, loading: false, error: false };
  const listeners = new Set<() => void>();
  const cache = new Map<string, { data: WorldPhotos; at: number }>();
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let version = 0, activeKey = '';
  const emit = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const stop = () => { version++; controller?.abort(); if (timer) clearTimeout(timer); timer = null; activeKey = ''; };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    load(region: MapRegion, force = false) {
      const key = JSON.stringify(viewportFor(region));
      if (!force && activeKey === key) return;
      stop(); activeKey = key;
      const cached = cache.get(key);
      if (!force && cached && Date.now() - cached.at < 30_000) { emit({ ...cached.data, loading: false, error: false }); return; }
      emit({ items: [], truncated: false, loading: true, error: false });
      const current = version;
      timer = setTimeout(async () => {
        controller = new AbortController();
        try {
          const data = await fetcher(region, controller.signal);
          if (current !== version) return;
          cache.set(key, { data, at: Date.now() });
          if (cache.size > 8) cache.delete(cache.keys().next().value!);
          emit({ ...data, loading: false });
        } catch { if (current === version) { activeKey = ''; emit({ error: true, loading: false }); } }
      }, 350);
    },
    suspend() { stop(); emit({ items: [], loading: false, error: false, truncated: false }); },
    clear() { stop(); cache.clear(); emit({ items: [], loading: false, error: false, truncated: false }); },
  };
}

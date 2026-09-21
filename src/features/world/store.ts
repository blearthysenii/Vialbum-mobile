import type { MapRegion } from '@/features/map/types';
import type { WorldData, WorldMode } from './api';
import { movedEnough, viewportKey, WORLD_REGION } from './viewport';

export type WorldState = { mode: WorldMode; region: MapRegion; data: WorldData | null; loading: boolean; error: string | null };
export function createWorldStore(fetcher: (mode: WorldMode, region: MapRegion, signal: AbortSignal) => Promise<WorldData>) {
  let state: WorldState = { mode: 'explore', region: WORLD_REGION, data: null, loading: false, error: null };
  const cache = new Map<string, { data: WorldData; at: number }>();
  const regions: Record<WorldMode, MapRegion> = { explore: WORLD_REGION, own: WORLD_REGION };
  const listeners = new Set<() => void>();
  let version = 0, controller: AbortController | null = null, timer: ReturnType<typeof setTimeout> | null = null;
  let inFlightKey: string | null = null;
  const emit = (patch: Partial<WorldState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const stop = () => { version++; controller?.abort(); inFlightKey = null; if (timer) clearTimeout(timer); timer = null; };
  async function load(force = false) {
    const key = viewportKey(state.mode, state.region);
    if (inFlightKey === key) return;
    const cached = cache.get(key);
    if (!force && cached && Date.now() - cached.at < 30_000) { emit({ data: cached.data, loading: false, error: null }); return; }
    stop(); const current = version;
    inFlightKey = key;
    controller = new AbortController();
    emit({ loading: true, error: null });
    try {
      const data = await fetcher(state.mode, state.region, controller.signal);
      if (version !== current) return;
      cache.set(key, { data, at: Date.now() });
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
      emit({ data });
    } catch { if (version === current) emit({ error: 'Map could not refresh. Showing previously loaded places, if available.' }); }
    finally { if (version === current) { inFlightKey = null; emit({ loading: false }); } }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    refresh: () => load(true),
    setRegion(region: MapRegion, force = false) {
      if (!force && !movedEnough(state.region, region)) return;
      stop(); regions[state.mode] = region;
      emit({ region, loading: true });
      timer = setTimeout(() => void load(), 350);
    },
    setMode(mode: WorldMode) {
      if (mode === state.mode) return;
      stop(); const region = regions[mode];
      // Never carry markers/stats from one context into the other.
      emit({ mode, region, data: cache.get(viewportKey(mode, region))?.data ?? null, error: null, loading: false });
      void load();
    },
    suspend() { stop(); emit({ loading: false }); },
    clear() { stop(); cache.clear(); regions.explore = WORLD_REGION; regions.own = WORLD_REGION; emit({ mode: 'explore', region: WORLD_REGION, data: null, loading: false, error: null }); },
  };
}

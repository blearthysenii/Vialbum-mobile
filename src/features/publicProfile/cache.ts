import { createSessionResource } from '@/utils/sessionResource';
import { createDiscoverStore } from '@/features/discover/store';
import { publicProfileApi } from './api';
const caches = new Map<string, { identity: ReturnType<typeof createSessionResource<Awaited<ReturnType<typeof publicProfileApi.get>>>>; journeys: ReturnType<typeof createDiscoverStore>; active: number; isRetained: () => boolean; retainActive: () => () => void }>();
export function publicProfileFor(viewer: string, owner: string) {
  const key = `${viewer}:${owner}`;
  let cached = caches.get(key);
  if (!cached) {
    const activity = { value: 0 };
    cached = { isRetained: () => caches.get(key) === cached, active: 0, retainActive: () => { activity.value++; if (cached) cached.active = activity.value; return () => { activity.value = Math.max(0, activity.value - 1); if (cached) cached.active = activity.value; }; }, identity: createSessionResource(signal => publicProfileApi.get(owner, signal), 'public-identity'), journeys: createDiscoverStore(viewer, (cursor, signal) => publicProfileApi.journeys(owner, cursor, signal), true, true) };
  }
  caches.delete(key); caches.set(key, cached);
  for (const [id, entry] of caches) {
    if (caches.size <= 12) break;
    if (id !== key && entry.active === 0) { entry.identity.clear(); entry.journeys.clear(); caches.delete(id); }
  }
  return cached;
}
export function clearPublicProfileCache() { caches.forEach(entry => { entry.identity.clear(); entry.journeys.clear(); }); caches.clear(); }

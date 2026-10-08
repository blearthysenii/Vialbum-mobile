import { createSessionResource } from '@/utils/sessionResource';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia } from '@/features/media/types';
import type { Journey } from '@/features/journeys/types';
import type { ProfileJourney } from './types';

const stores = new Map<string, ReturnType<typeof createSessionResource<JourneyMedia[]>>>();
const collections = new Map<string, 'journeys' | 'moments'>();
export function profileMediaFor(userId: string, journeyId: string) {
  const key = `${userId}:${journeyId}`;
  let store = stores.get(key);
  if (!store) { store = createSessionResource(signal => mediaApi.list(journeyId, signal), 'journey-media'); stores.set(key, store); }
  stores.delete(key); stores.set(key, store);
  for (const [id, candidate] of stores) {
    if (stores.size <= 24) break;
    if (id !== key && !candidate.hasSubscribers()) { candidate.clear(); stores.delete(id); }
  }
  return store;
}
const albumObjects = new WeakMap<Journey, { owner: string | undefined; media: JourneyMedia[]; album: ProfileJourney }>();
const EMPTY_MEDIA: JourneyMedia[] = [];
export function cachedProfileAlbums(userId: string | undefined, journeys: Journey[]): ProfileJourney[] {
  return journeys.map(journey => {
    const media = userId ? stores.get(`${userId}:${journey.id}`)?.getSnapshot().data ?? EMPTY_MEDIA : EMPTY_MEDIA;
    const cached = albumObjects.get(journey);
    if (cached && cached.owner === userId && cached.media === media) return cached.album;
    const album = { ...journey, memories: [], media };
    albumObjects.set(journey, { owner: userId, media, album }); return album;
  });
}
export const profileCollection = {
  get: (id: string | undefined) => id ? collections.get(id) ?? 'journeys' : 'journeys',
  set: (id: string, value: 'journeys' | 'moments') => { collections.set(id, value); },
};
export function invalidateProfileMedia(userId: string, journeyId: string) { stores.get(`${userId}:${journeyId}`)?.invalidate(); }
export function clearProfileDataCache() { stores.forEach(store => store.clear()); stores.clear(); collections.clear(); }

import { Image } from 'expo-image';

import { journeyApi } from '@/features/journeys/api';
import type { Journey } from '@/features/journeys/types';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import type { Memory } from '@/features/memories/types';

export type PreparedJourneyDetails = {
  journey: Journey;
  media: JourneyMedia[];
  memories: Memory[];
};

type CacheEntry = PreparedJourneyDetails & { cachedAt: number };

const CACHE_LIFETIME_MS = 60_000;
const cache = new Map<string, CacheEntry>();
const pending = new Map<string, Promise<PreparedJourneyDetails>>();

export function readPreparedJourneyDetails(id: string) {
  const entry = cache.get(id);
  if (!entry || Date.now() - entry.cachedAt > CACHE_LIFETIME_MS) return null;
  return { journey: entry.journey, memories: entry.memories, media: entry.media };
}

export function storePreparedJourneyDetails(details: PreparedJourneyDetails) {
  cache.set(details.journey.id, { ...details, cachedAt: Date.now() });
}

async function prefetchCover(url: string | null | undefined) {
  if (!url) return;
  try {
    await Image.prefetch(url, 'memory-disk');
  } catch {
    // The neutral background remains available if an image cannot be cached.
  }
}

export function prepareJourneyDetails(id: string, knownJourney?: Journey) {
  const cached = readPreparedJourneyDetails(id);
  if (cached) return Promise.resolve(cached);

  const existing = pending.get(id);
  if (existing) return existing;

  const request = Promise.all([
    journeyApi.fetchJourney(id),
    memoryApi.list(id),
    mediaApi.list(id),
    prefetchCover(knownJourney?.cover_media_url),
  ]).then(async ([journey, memories, media]) => {
    await prefetchCover(journey.cover_media_url);
    const details = { journey, memories, media };
    storePreparedJourneyDetails(details);
    return details;
  }).finally(() => pending.delete(id));

  pending.set(id, request);
  return request;
}

export function clearPreparedJourneyDetails(id?: string) {
  if (id) {
    cache.delete(id);
    pending.delete(id);
    return;
  }
  cache.clear();
  pending.clear();
}

import type { Memory } from '@/features/memories/types';
import type { PublicJourneyDetail, PublicPhoto } from './types';

export type PublicTimelineItem = { id: string; date: string; memory: Memory | null; photos: PublicPhoto[] };
export function publicTimeline(journey: PublicJourneyDetail): PublicTimelineItem[] {
  const byMemory = new Map<string, PublicPhoto[]>();
  const memoryIds = new Set(journey.memories.map((memory) => memory.id));
  const loose: PublicTimelineItem[] = [];
  for (const photo of journey.photos) {
    if (photo.memory_id && memoryIds.has(photo.memory_id)) {
      byMemory.set(photo.memory_id, [...(byMemory.get(photo.memory_id) ?? []), photo]);
    } else {
      loose.push({ id: `photo:${photo.id}`, date: (photo.captured_at ?? photo.created_at).slice(0, 10), memory: null, photos: [photo] });
    }
  }
  return [...journey.memories.map((memory) => ({ id: `memory:${memory.id}`, date: memory.memory_date, memory, photos: byMemory.get(memory.id) ?? [] })), ...loose]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
export function publicMapPoints(journey: PublicJourneyDetail) {
  const candidates = [journey, ...journey.memories, ...journey.photos];
  return candidates.flatMap((item) => {
    if (item.latitude == null || item.longitude == null) return [];
    const latitude = Number(item.latitude); const longitude = Number(item.longitude);
    return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180
      ? [{ id: item.id, latitude, longitude }] : [];
  });
}

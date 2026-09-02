import type { Journey } from '@/features/journeys/types';
import type { JourneyMedia } from '@/features/media/types';
import type { Memory } from '@/features/memories/types';
import { groupTimeline, type TimelineSection } from '@/features/timeline/groupTimeline';

export type JourneySummary = {
  durationDays: number;
  populatedDays: number;
  memoryCount: number;
  photoCount: number;
  mappedItemCount: number;
  uniquePlaceCount: number;
  earliestContentDate: string | null;
  latestContentDate: string | null;
  firstPopulatedDay: number | null;
  lastPopulatedDay: number | null;
};

export type JourneyStat = { label: string; value: string };

function inclusiveDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${endDate.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end) && end >= start
    ? Math.round((end - start) / 86400000) + 1
    : 1;
}

export function deriveJourneySummary(
  journey: Journey,
  memories: Memory[],
  media: JourneyMedia[],
): JourneySummary {
  const photos = media.filter((item) => item.type === 'photo');
  const sections = groupTimeline(journey.start_date, memories, photos);
  const places = new Set(
    [journey.place_id, ...memories.map((item) => item.place_id), ...photos.map((item) => item.place_id)]
      .filter((id): id is string => Boolean(id)),
  );
  const mappedItemCount = [...memories, ...photos]
    .filter((item) => item.latitude !== null && item.longitude !== null).length;
  return {
    durationDays: inclusiveDays(journey.start_date, journey.end_date),
    populatedDays: sections.length,
    memoryCount: memories.length,
    photoCount: photos.length,
    mappedItemCount,
    uniquePlaceCount: places.size,
    earliestContentDate: sections[0]?.date ?? null,
    latestContentDate: sections.at(-1)?.date ?? null,
    firstPopulatedDay: sections[0]?.day ?? null,
    lastPopulatedDay: sections.at(-1)?.day ?? null,
  };
}

export function journeyStats(summary: JourneySummary): JourneyStat[] {
  return [
    { label: summary.durationDays === 1 ? 'Day' : 'Days', value: String(summary.durationDays) },
    ...(summary.memoryCount > 0 ? [{ label: summary.memoryCount === 1 ? 'Memory' : 'Memories', value: String(summary.memoryCount) }] : []),
    ...(summary.photoCount > 0 ? [{ label: summary.photoCount === 1 ? 'Photo' : 'Photos', value: String(summary.photoCount) }] : []),
    ...(summary.uniquePlaceCount > 0 ? [{ label: summary.uniquePlaceCount === 1 ? 'Place' : 'Places', value: String(summary.uniquePlaceCount) }] : []),
  ];
}

function selectedPhotosForDay(section: TimelineSection, limit: number) {
  const photos = section.data.filter((item) => item.type === 'photo');
  const selected = new Set<string>();
  const add = (id: string) => { if (selected.size < limit) selected.add(id); };
  photos.filter((item) => item.type === 'photo' && item.photo.memory_id).forEach((item) => add(item.id));
  photos.filter((item) => item.type === 'photo' && item.photo.caption).forEach((item) => add(item.id));
  photos.forEach((item) => add(item.id));
  return selected;
}

export function buildRecapSections(
  startDate: string,
  memories: Memory[],
  media: JourneyMedia[],
  photosPerDay = 4,
): TimelineSection[] {
  return groupTimeline(startDate, memories, media).map((section) => {
    const selectedPhotos = selectedPhotosForDay(section, photosPerDay);
    return {
      ...section,
      data: section.data.filter((item) => item.type === 'memory' || selectedPhotos.has(item.id)),
    };
  });
}

export function selectJourneyHighlights(
  journey: Journey,
  sections: TimelineSection[],
  limit = 5,
): JourneyMedia[] {
  const photos = sections.flatMap((section) =>
    section.data.flatMap((item) => item.type === 'photo' ? [item.photo] : []),
  );
  if (photos.length < 2) return [];
  const selected: JourneyMedia[] = [];
  const ids = new Set<string>();
  const add = (photo: JourneyMedia | undefined) => {
    if (photo && selected.length < limit && !ids.has(photo.id)) {
      selected.push(photo);
      ids.add(photo.id);
    }
  };
  add(photos.find((photo) => photo.id === journey.cover_media_id));
  add(photos.find((photo) => photo.memory_id !== null));
  add(photos.find((photo) => Boolean(photo.caption)));
  for (const section of sections) {
    add(section.data.find((item) => item.type === 'photo')?.photo);
  }
  for (const photo of photos) add(photo);
  return selected;
}


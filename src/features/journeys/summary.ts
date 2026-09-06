import type { Journey } from '@/features/journeys/types';
import type { JourneyMedia } from '@/features/media/types';
import type { Memory } from '@/features/memories/types';
import { groupTimeline } from '@/features/timeline/groupTimeline';

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

export function journeyTimelineStats(summary: JourneySummary): JourneyStat[] {
  return [
    { label: summary.durationDays === 1 ? 'Day' : 'Days', value: String(summary.durationDays) },
    {
      label: summary.memoryCount === 1 ? 'Memory' : 'Memories',
      value: String(summary.memoryCount),
    },
    {
      label: summary.photoCount === 1 ? 'Photo' : 'Photos',
      value: String(summary.photoCount),
    },
    {
      label: summary.uniquePlaceCount === 1 ? 'Place' : 'Places',
      value: String(summary.uniquePlaceCount),
    },
  ];
}

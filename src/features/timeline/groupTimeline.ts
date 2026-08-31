import type { JourneyMedia } from '../media/types';
import type { Memory } from '../memories/types';

export type TimelineItem =
  | { type: 'memory'; id: string; memory: Memory }
  | { type: 'photo'; id: string; photo: JourneyMedia };

export type TimelineSection = { date: string; day: number; data: TimelineItem[] };

// Calendar days must not shift with the device timezone or daylight saving time.
function calendarDay(value: string | null | undefined): string | undefined {
  const day = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (!day) return undefined;
  const timestamp = Date.parse(`${day}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day ? day : undefined;
}

function time(value: string | null | undefined): number | undefined {
  if (!value || !calendarDay(value)) return undefined;
  // EXIF timestamps can be timezone-free: compare those consistently as UTC.
  const normalized = /T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(value) ? `${value}Z` : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function itemTime(item: TimelineItem): number {
  return item.type === 'memory'
    ? time(item.memory.created_at) ?? 0
    : time(item.photo.captured_at) ?? time(item.photo.created_at) ?? 0;
}

export function groupTimeline(startDate: string, memories: Memory[], photos: JourneyMedia[]): TimelineSection[] {
  const start = calendarDay(startDate);
  if (!start) return [];
  const groups = new Map<string, TimelineItem[]>();
  function add(date: string, item: TimelineItem) {
    const items = groups.get(date) ?? [];
    items.push(item);
    groups.set(date, items);
  }
  for (const memory of memories) {
    add(calendarDay(memory.memory_date) ?? start, { type: 'memory', id: memory.id, memory });
  }
  for (const photo of photos) {
    if (photo.type !== 'photo') continue;
    const date = calendarDay(photo.captured_at) ?? calendarDay(photo.created_at) ?? start;
    add(date, { type: 'photo', id: photo.id, photo });
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, data]) => ({
    date,
    day: Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1,
    data: data.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'memory' ? -1 : 1;
      return itemTime(a) - itemTime(b) || a.id.localeCompare(b.id);
    }),
  }));
}

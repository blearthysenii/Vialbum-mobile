import type { PlaceSelection, Place } from '@/features/places/types';
export type DraftStop = { id: string; label: string; place: PlaceSelection; mediaKeys: string[] };
export type JourneyStop = { id: string; label: string; place: Place; sort_order: number; media_ids: string[] };
export function deriveStops(media: { key: string; place: PlaceSelection | null }[], id: () => string): DraftStop[] {
  const stops: DraftStop[] = [];
  for (const item of media) {
    if (!item.place) continue;
    const existing = stops.find(stop => stop.place.provider === item.place!.provider && stop.place.provider_place_id === item.place!.provider_place_id);
    if (existing) existing.mediaKeys.push(item.key);
    else stops.push({ id: id(), label: item.place.name, place: item.place, mediaKeys: [item.key] });
  }
  return stops;
}
export function reorderStop(stops: DraftStop[], index: number, offset: number) {
  if (index + offset < 0 || index + offset >= stops.length) return stops;
  const next = [...stops]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; return next;
}

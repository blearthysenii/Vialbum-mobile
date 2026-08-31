import type { MapFilter, MapItem } from '@/features/map/types';

export type MappedItem = MapItem & { coordinate: { latitude: number; longitude: number } };

export function mappedItems(items: MapItem[], filter: MapFilter): MappedItem[] {
  return items.flatMap((item) => {
    if (filter !== 'all' && item.type !== filter) return [];
    if (item.latitude.trim() === '' || item.longitude.trim() === '') return [];
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    return [{ ...item, coordinate: { latitude, longitude } }];
  });
}

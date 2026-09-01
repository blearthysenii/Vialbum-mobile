import type { MapFilter, MapItem, MapRegion } from '@/features/map/types';

export type MappedItem = MapItem & { coordinate: { latitude: number; longitude: number } };
export type MapPointMarker = { kind: 'item'; key: string; coordinate: MappedItem['coordinate']; item: MappedItem };
export type MapClusterMarker = {
  kind: 'cluster';
  key: string;
  coordinate: MappedItem['coordinate'];
  items: MappedItem[];
  bounds: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
};
export type PreparedMapMarker = MapPointMarker | MapClusterMarker;

const markerKey = (item: Pick<MapItem, 'type' | 'id'>) => `${item.type}:${item.id}`;

function longitudeOffset(longitude: number, center: number) {
  return ((longitude - center + 540) % 360) - 180;
}

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

export function itemIsVisible(item: MappedItem, region: MapRegion, padding = 1.2) {
  return Math.abs(item.coordinate.latitude - region.latitude) <= region.latitudeDelta * padding / 2
    && Math.abs(longitudeOffset(item.coordinate.longitude, region.longitude)) <= region.longitudeDelta * padding / 2;
}

export function prepareMapMarkers(
  items: MappedItem[],
  region: MapRegion,
  width: number,
  height: number,
  cellSize = 58,
): PreparedMapMarker[] {
  if (width <= 0 || height <= 0 || region.latitudeDelta <= 0 || region.longitudeDelta <= 0) return [];
  const visible = items.filter((item) => itemIsVisible(item, region));
  const cells = new Map<string, MappedItem[]>();
  for (const item of visible) {
    const x = (longitudeOffset(item.coordinate.longitude, region.longitude) / region.longitudeDelta + 0.5) * width;
    const y = (0.5 - (item.coordinate.latitude - region.latitude) / region.latitudeDelta) * height;
    const cell = `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
    cells.set(cell, [...(cells.get(cell) ?? []), item]);
  }
  return [...cells.entries()].map(([cell, grouped]) => {
    if (grouped.length === 1) {
      const item = grouped[0];
      return { kind: 'item', key: markerKey(item), coordinate: item.coordinate, item };
    }
    const latitudes = grouped.map((item) => item.coordinate.latitude);
    const offsets = grouped.map((item) => longitudeOffset(item.coordinate.longitude, region.longitude));
    const longitude = region.longitude + offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
    return {
      kind: 'cluster',
      key: `cluster:${cell}:${grouped.map(markerKey).sort().join('|')}`,
      coordinate: {
        latitude: latitudes.reduce((sum, value) => sum + value, 0) / latitudes.length,
        longitude: ((longitude + 540) % 360) - 180,
      },
      items: grouped,
      bounds: {
        minLatitude: Math.min(...latitudes),
        maxLatitude: Math.max(...latitudes),
        minLongitude: Math.min(...grouped.map((item) => item.coordinate.longitude)),
        maxLongitude: Math.max(...grouped.map((item) => item.coordinate.longitude)),
      },
    };
  });
}

export function clusterExpansionRegion(cluster: MapClusterMarker, current: MapRegion): MapRegion | null {
  const latitudeSpan = cluster.bounds.maxLatitude - cluster.bounds.minLatitude;
  const longitudeSpan = cluster.bounds.maxLongitude - cluster.bounds.minLongitude;
  if (current.latitudeDelta <= 0.004 && current.longitudeDelta <= 0.004) return null;
  return {
    latitude: cluster.coordinate.latitude,
    longitude: cluster.coordinate.longitude,
    latitudeDelta: Math.max(latitudeSpan * 2.5, current.latitudeDelta / 2, 0.002),
    longitudeDelta: Math.max(longitudeSpan * 2.5, current.longitudeDelta / 2, 0.002),
  };
}

export function selectedItemForFilter(
  selectedKey: string | null,
  items: MappedItem[],
) {
  if (!selectedKey) return null;
  return items.find((item) => markerKey(item) === selectedKey) ?? null;
}

export function mapItemDayNumber(item: Pick<MapItem, 'date' | 'journey_start_date'>) {
  if (!item.date) return null;
  const start = Date.parse(`${item.journey_start_date}T00:00:00Z`);
  const date = Date.parse(`${item.date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(date)
    ? Math.round((date - start) / 86400000) + 1
    : null;
}

export function mapItemKey(item: Pick<MapItem, 'type' | 'id'>) {
  return markerKey(item);
}

import type { MapRegion } from '@/features/map/types';
import { clusterExpansionRegion } from '@/features/map/utils';
import type { Bounds, WorldMarker, WorldMode } from './api';

export const WORLD_REGION: MapRegion = { latitude: 20, longitude: 0, latitudeDelta: 140, longitudeDelta: 350 };
const wrap = (n: number) => ((n + 540) % 360) - 180;
export function viewportFor(region: MapRegion) {
  const span = Math.min(360, Math.max(0.0001, region.longitudeDelta));
  return { north: Math.min(90, region.latitude + region.latitudeDelta / 2), south: Math.max(-90, region.latitude - region.latitudeDelta / 2), west: span >= 359 ? -180 : wrap(region.longitude - span / 2), east: span >= 359 ? 180 : wrap(region.longitude + span / 2), zoom: Math.min(20, Math.max(0, Math.log2(360 / span))), limit: 200 };
}
export function movedEnough(a: MapRegion, b: MapRegion) {
  return Math.abs(a.latitude - b.latitude) > a.latitudeDelta * 0.12 || Math.abs(wrap(a.longitude - b.longitude)) > a.longitudeDelta * 0.12 || Math.abs(a.latitudeDelta - b.latitudeDelta) > a.latitudeDelta * 0.12 || Math.abs(a.longitudeDelta - b.longitudeDelta) > a.longitudeDelta * 0.12;
}
export function viewportKey(mode: WorldMode, region: MapRegion) { return `${mode}:${JSON.stringify(viewportFor(region))}`; }
export function fitBounds(bounds: Bounds): MapRegion {
  return { latitude: (bounds.north + bounds.south) / 2, longitude: (bounds.east + bounds.west) / 2, latitudeDelta: Math.min(170, Math.max(0.08, (bounds.north - bounds.south) * 1.5)), longitudeDelta: Math.min(359, Math.max(0.08, (bounds.east - bounds.west) * 1.5)) };
}
export function expandCluster(marker: WorldMarker, region: MapRegion) {
  return clusterExpansionRegion({ coordinate: { latitude: marker.latitude, longitude: marker.longitude }, bounds: { minLatitude: marker.bounds.south, maxLatitude: marker.bounds.north, minLongitude: marker.bounds.west, maxLongitude: marker.bounds.east } }, region);
}
export function worldMapTarget(mode: WorldMode, latitude: number, longitude: number) {
  return { pathname: '/(tabs)/map' as const, params: { worldMode: mode, latitude: String(latitude), longitude: String(longitude), focusRequest: String(Date.now()) } };
}

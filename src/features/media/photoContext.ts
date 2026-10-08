import type { PublicPhoto } from '@/features/discover/types';
export type LocatedPhoto = Pick<PublicPhoto, 'latitude' | 'longitude' | 'place' | 'captured_at'>;
export function photoCoordinate(photo: LocatedPhoto) {
  const pair = (latitude: string | null | undefined, longitude: string | null | undefined) => {
    if (!latitude?.trim() || !longitude?.trim()) return null;
    const lat = Number(latitude), lon = Number(longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { latitude: lat, longitude: lon } : null;
  };
  return pair(photo.latitude, photo.longitude) ?? pair(photo.place?.latitude, photo.place?.longitude);
}
export function photoDay(photo: LocatedPhoto, startDate?: string) {
  if (!photo.captured_at) return null;
  const date = Date.parse(photo.captured_at.slice(0, 10));
  if (!Number.isFinite(date)) return null;
  const start = startDate ? Date.parse(startDate.slice(0, 10)) : NaN;
  const day = Math.floor((date - start) / 86400000) + 1;
  return Number.isFinite(day) && day > 0 ? `Day ${day}` : new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

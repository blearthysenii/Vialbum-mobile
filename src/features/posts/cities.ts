import type { PlaceSelection } from '@/features/places/types';
import type { PostJourney } from './data';
import type { MapRegion } from '@/features/map/types';

const normalize = (text: string) => text.normalize('NFC').trim().toLocaleLowerCase();
export type CityQuery = { name: string; country: string; code: string };
export type PostCity = { id: string; name: string; country: string; latitude: number; longitude: number };

export function journeyCityQueries(journey: PostJourney): CityQuery[] {
  const seenPlaces = new Set<string>();
  const cities = new Map<string, CityQuery>();
  for (const place of [journey.place, ...journey.photos.map(photo => photo.place)]) {
    if (!place) continue;
    const identity = place.id || `${place.provider}:${place.provider_place_id}`;
    if (seenPlaces.has(identity)) continue;
    seenPlaces.add(identity);
    const name = (place.locality || place.name).trim();
    if (!name || !place.country.trim()) continue;
    const city = { name, country: place.country.trim(), code: place.country_code.toUpperCase() };
    cities.set(`${normalize(name)}:${city.code}`, city);
  }
  if (!journey.place && journey.destination?.trim() && journey.country?.trim()) {
    const name = journey.destination.trim(), country = journey.country.trim();
    if (![...cities.values()].some(city => normalize(city.name) === normalize(name) && normalize(city.country) === normalize(country))) {
      cities.set(`${normalize(name)}:${normalize(country)}`, { name, country, code: '' });
    }
  }
  return [...cities.values()];
}

export function cityFromResults(query: CityQuery, results: PlaceSelection[]): PostCity | null {
  // Only a city-level search result qualifies. Never reuse precise photo/POI coordinates.
  const place = results.find(item => normalize(item.name) === normalize(query.name)
    && Boolean(item.locality) && normalize(item.locality!) === normalize(query.name)
    && (query.code ? item.country_code.toUpperCase() === query.code : normalize(item.country) === normalize(query.country))
    && item.latitude.trim() !== '' && item.longitude.trim() !== ''
    && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))
    && Math.abs(Number(item.latitude)) <= 90 && Math.abs(Number(item.longitude)) <= 180);
  return place ? { id: `${place.provider}:${place.provider_place_id}`, name: place.locality!, country: place.country, latitude: Number(place.latitude), longitude: Number(place.longitude) } : null;
}

export function cityRegion(cities: PostCity[]): MapRegion | null {
  if (!cities.length) return null;
  const north = Math.max(...cities.map(city => city.latitude)), south = Math.min(...cities.map(city => city.latitude));
  const longitudes = cities.map(city => (city.longitude + 360) % 360).sort((a, b) => a - b);
  let gap = -1, start = longitudes[0];
  longitudes.forEach((longitude, index) => {
    const next = index + 1 < longitudes.length ? longitudes[index + 1] : longitudes[0] + 360;
    if (next - longitude > gap) { gap = next - longitude; start = next % 360; }
  });
  const span = 360 - gap;
  return { latitude: (north + south) / 2, longitude: ((start + span / 2 + 180) % 360) - 180,
    latitudeDelta: Math.min(170, Math.max(0.12, (north - south) * 1.5)), longitudeDelta: Math.min(359, Math.max(0.12, span * 1.5)) };
}

import type { PlaceSelection } from '@/features/places/types';

export const MIN_PLACE_QUERY_LENGTH = 2;

export function canSearchPlaces(query: string) {
  return query.trim().length >= MIN_PLACE_QUERY_LENGTH;
}

export function formatPlaceContext(place: PlaceSelection) {
  return [place.locality !== place.name ? place.locality : null, place.region, place.country]
    .filter(Boolean)
    .join(', ');
}

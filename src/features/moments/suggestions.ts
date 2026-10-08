import type { Journey } from '@/features/journeys/types';
import type { PlaceSelection } from '@/features/places/types';
export function suggestedMomentJourneys(journeys: Journey[], place: PlaceSelection | null, capturedAt?: string) {
  if (!place) return [];
  const day = capturedAt?.slice(0, 10);
  return journeys.map(journey => {
    const sameCountry = (journey.place?.country_code || journey.country_code) === place.country_code;
    const sameCity = Boolean(sameCountry && place.locality && journey.place?.locality === place.locality);
    const samePlace = journey.place?.provider === place.provider && journey.place?.provider_place_id === place.provider_place_id;
    const duringTrip = Boolean(day && journey.start_date <= day && day <= journey.end_date);
    return { journey, score: (sameCountry ? 30 : 0) + (sameCity ? 30 : 0) + (samePlace ? 80 : 0) + (sameCountry && duringTrip ? 20 : 0) };
  }).filter(item => item.score > 0).sort((a, b) => b.score-a.score || b.journey.created_at.localeCompare(a.journey.created_at)).map(item => item.journey);
}

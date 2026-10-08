import { apiRequest } from '@/api/client';

export type TravelCountry = {
  code: string; name: string; continent: string; journey_count: number; photo_count: number;
  cities: string[]; last_visited: string; cover_url: string | null;
};
export type TravelProgress = {
  stats: { countries: number; continents: number; country_total: number; world_percentage: number; unassigned_journeys: number };
  countries: TravelCountry[];
  continents: { name: string; countries_visited: number; country_total: number }[];
  recently_visited: string[];
};
export type CountryJourneys = { country: TravelCountry; journeys: {
  id: string; title: string; destination: string; start_date: string; end_date: string; cover_url: string | null;
}[] };
export const travelApi = {
  progress: (signal: AbortSignal) => apiRequest<TravelProgress>('/map/travel', { authenticated: true, signal }),
  journeys: (code: string, signal: AbortSignal) => apiRequest<CountryJourneys>(`/map/countries/${encodeURIComponent(code)}/journeys`, { authenticated: true, signal }),
};
export function countryFlag(code: string) {
  return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(char => 127397 + char.charCodeAt(0))) : '';
}
export function countLabel(count: number, noun: string) { return `${count} ${count === 1 ? noun : noun === 'country' ? 'countries' : `${noun}s`}`; }

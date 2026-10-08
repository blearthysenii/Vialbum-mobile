import type { JourneyPage } from './profileStore';
import type { JourneyStop } from './stops';
import type { PlaceSelection } from '@/features/places/types';
import { apiRequest } from '@/api/client';
import type { Journey, JourneyInput, JourneyUpdate } from '@/features/journeys/types';

export const journeyApi = {
  page: (cursor: string | null, signal: AbortSignal) => apiRequest<JourneyPage>(`/journeys/page?${new URLSearchParams({ limit: '24', ...(cursor ? { cursor } : {}) })}`, { authenticated: true, signal }),
  stops: (id: string) => apiRequest<JourneyStop[]>(`/journeys/${id}/stops`, { authenticated: true }),
  saveStops: (id: string, stops: { id: string; label: string; place: PlaceSelection; media_ids: string[] }[]) => apiRequest<JourneyStop[]>(`/journeys/${id}/stops`, { method: 'PUT', body: stops, authenticated: true }),
  fetchJourneys: () => apiRequest<Journey[]>('/journeys', { authenticated: true }),
  fetchJourney: (id: string) => apiRequest<Journey>(`/journeys/${id}`, { authenticated: true }),
  createJourney: (input: JourneyInput) =>
    apiRequest<Journey>('/journeys', { method: 'POST', body: input, authenticated: true }),
  updateJourney: (id: string, input: JourneyUpdate) =>
    apiRequest<Journey>(`/journeys/${id}`, {
      method: 'PATCH',
      body: input,
      authenticated: true,
    }),
  deleteJourney: (id: string) =>
    apiRequest<void>(`/journeys/${id}`, { method: 'DELETE', authenticated: true }),
};

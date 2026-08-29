import { apiRequest } from '@/api/client';
import type { Journey, JourneyInput, JourneyUpdate } from '@/features/journeys/types';

export const journeyApi = {
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

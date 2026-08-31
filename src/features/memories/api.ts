import { apiRequest } from '@/api/client';
import type { Memory, MemoryInput } from '@/features/memories/types';

const path = (journeyId: string) => `/journeys/${journeyId}/memories`;
export const memoryApi = {
  list: (journeyId: string) => apiRequest<Memory[]>(path(journeyId), { authenticated: true }),
  get: (journeyId: string, id: string) => apiRequest<Memory>(`${path(journeyId)}/${id}`, { authenticated: true }),
  create: (journeyId: string, body: MemoryInput) => apiRequest<Memory>(path(journeyId), { method: 'POST', body, authenticated: true }),
  update: (journeyId: string, id: string, body: Partial<MemoryInput>) => apiRequest<Memory>(`${path(journeyId)}/${id}`, { method: 'PATCH', body, authenticated: true }),
  remove: (journeyId: string, id: string) => apiRequest<void>(`${path(journeyId)}/${id}`, { method: 'DELETE', authenticated: true }),
};

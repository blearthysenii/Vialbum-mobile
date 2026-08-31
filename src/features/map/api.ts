import { apiRequest } from '@/api/client';
import type { MapItem } from '@/features/map/types';

export const mapApi = {
  list: () => apiRequest<MapItem[]>('/map/items', { authenticated: true }),
};

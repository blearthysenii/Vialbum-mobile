import { apiRequest } from '@/api/client';
import type { MapItem } from '@/features/map/types';

export const mapApi = {
  list: ({ includeThumbnails = false }: { includeThumbnails?: boolean } = {}) =>
    apiRequest<MapItem[]>(
      `/map/items?include_thumbnails=${includeThumbnails ? 'true' : 'false'}`,
      { authenticated: true },
    ),
  thumbnail: (type: MapItem['type'], id: string) =>
    apiRequest<{ thumbnail_url: string | null }>(
      `/map/items/${type}/${id}/thumbnail`,
      { authenticated: true },
    ),
};

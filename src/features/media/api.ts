import { apiRequest, apiUpload } from '@/api/client';
import type { Journey } from '@/features/journeys/types';
import type { JourneyMedia, SelectedPhoto } from '@/features/media/types';

function metadata(photo: SelectedPhoto) {
  const fields: Record<string, string> = {};
  if (photo.width) fields.width = String(photo.width);
  if (photo.height) fields.height = String(photo.height);
  if (photo.capturedAt) fields.captured_at = photo.capturedAt;
  if (photo.latitude !== undefined) fields.latitude = String(photo.latitude);
  if (photo.longitude !== undefined) fields.longitude = String(photo.longitude);
  return fields;
}

export const mediaApi = {
  list: (journeyId: string) =>
    apiRequest<JourneyMedia[]>(`/journeys/${journeyId}/media`, { authenticated: true }),
  upload: (journeyId: string, photo: SelectedPhoto, onProgress: (value: number) => void) =>
    apiUpload<JourneyMedia>(
      `/journeys/${journeyId}/media`,
      { uri: photo.uri, name: photo.name, type: photo.mimeType },
      metadata(photo),
      onProgress,
    ),
  updateCaption: (journeyId: string, mediaId: string, caption: string | null) =>
    apiRequest<JourneyMedia>(`/journeys/${journeyId}/media/${mediaId}`, {
      method: 'PATCH', body: { caption }, authenticated: true,
    }),
  remove: (journeyId: string, mediaId: string) =>
    apiRequest<void>(`/journeys/${journeyId}/media/${mediaId}`, {
      method: 'DELETE', authenticated: true,
    }),
  setCover: (journeyId: string, mediaId: string) =>
    apiRequest<Journey>(`/journeys/${journeyId}/cover/${mediaId}`, {
      method: 'PATCH', authenticated: true,
    }),
};

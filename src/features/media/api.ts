import { apiRequest, apiUpload } from '@/api/client';
import type { Journey } from '@/features/journeys/types';
import type { JourneyMedia, MediaUpdate, SelectedPhoto } from '@/features/media/types';

function metadata(photo: SelectedPhoto) {
  const fields: Record<string, string> = {};
  if (photo.videoEdit) {
    fields.trim_start = String(photo.videoEdit.trimStart);
    fields.trim_end = String(photo.videoEdit.trimEnd);
    fields.cover_time = String(photo.videoEdit.coverTime);
  }
  if (photo.requestId) fields.request_id = photo.requestId;
  if (photo.width) fields.width = String(photo.width);
  if (photo.height) fields.height = String(photo.height);
  if (photo.capturedAt) fields.captured_at = photo.capturedAt;
  if (photo.latitude !== undefined) fields.latitude = String(photo.latitude);
  if (photo.longitude !== undefined) fields.longitude = String(photo.longitude);
  return fields;
}

export const mediaApi = {
  list: (journeyId: string, signal?: AbortSignal) =>
    apiRequest<JourneyMedia[]>(`/journeys/${journeyId}/media`, { authenticated: true, signal }),
  upload: (journeyId: string, photo: SelectedPhoto, onProgress: (value: number) => void) =>
    apiUpload<JourneyMedia>(
      `/journeys/${journeyId}/${photo.type === 'video' ? 'videos' : 'media'}`,
      { uri: photo.uri, name: photo.name, type: photo.mimeType },
      metadata(photo),
      onProgress,
      photo.type === 'video' ? { timeoutMs: 300000, mediaLabel: 'video' } : undefined,
    ),
  updateCaption: (journeyId: string, mediaId: string, caption: string | null) =>
    apiRequest<JourneyMedia>(`/journeys/${journeyId}/media/${mediaId}`, {
      method: 'PATCH', body: { caption }, authenticated: true,
    }),
  update: (journeyId: string, mediaId: string, body: MediaUpdate) =>
    apiRequest<JourneyMedia>(`/journeys/${journeyId}/media/${mediaId}`, {
      method: 'PATCH', body, authenticated: true,
    }),
  remove: (journeyId: string, mediaId: string) =>
    apiRequest<void>(`/journeys/${journeyId}/media/${mediaId}`, {
      method: 'DELETE', authenticated: true,
    }),
  shareVideos: (journeyId: string) => apiRequest<string[]>(`/journeys/${journeyId}/videos/share`, { method: 'POST', authenticated: true }),
  setCover: (journeyId: string, mediaId: string) =>
    apiRequest<Journey>(`/journeys/${journeyId}/cover/${mediaId}`, {
      method: 'PATCH', authenticated: true,
    }),
};

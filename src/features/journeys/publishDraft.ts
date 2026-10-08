import { videoEditError, initialVideoEdit } from '@/features/media/videoEdit';
import type { Journey } from './types';
import { journeyApi } from './api';
import { mediaApi } from '@/features/media/api';
import { detailsError, type JourneyDraft } from './draft';

type Dependencies = { journeys: typeof journeyApi; media: typeof mediaApi };
export async function publishDraft(
  draft: JourneyDraft,
  checkpoint: (draft: JourneyDraft) => void,
  progress: (label: string, percent: number) => void,
  api: Dependencies = { journeys: journeyApi, media: mediaApi },
  onPublished?: (journey: Journey) => void,
) {
  const error = detailsError(draft.values);
  if (error) throw new Error(error);
  if (!draft.photos.length) throw new Error('Choose at least one photo.');
  if (draft.photos.some(photo => Array.from(photo.caption).length > 100)) throw new Error('Photo captions must be 100 characters or fewer.');
  for (const media of draft.photos) {
    if (media.type === 'video') {
      const invalid = videoEditError(media.videoEdit ?? initialVideoEdit(media.duration ?? 0), media.duration);
      if (invalid) throw new Error(invalid);
    }
  }
  let current = { ...draft, photos: draft.photos.map(photo => ({ ...photo })) };
  const save = () => checkpoint({ ...current, photos: [...current.photos] });
  progress('Preparing your journey…', 0);
  if (!current.journeyId) {
    const journey = await api.journeys.createJourney({ ...current.values, visibility: 'private', request_id: current.requestId });
    current.journeyId = journey.id;
    save();
  }
  const id = current.journeyId;
  // The requested visibility is applied only after every photo, caption and cover succeeds.
  await api.journeys.updateJourney(id, { ...current.values, visibility: 'private' });
  for (let index = 0; index < current.photos.length; index++) {
    const photo = current.photos[index];
    const label = `Uploading ${photo.type === 'video' ? 'video' : 'photo'} ${index + 1} of ${current.photos.length}`;
    progress(label, Math.round(index / current.photos.length * 90));
    if (!photo.mediaId) {
      const uploaded = await api.media.upload(id, { ...photo, videoEdit: photo.type === 'video' ? photo.videoEdit ?? initialVideoEdit(photo.duration ?? 0) : undefined, requestId: photo.requestId }, value =>
        progress(label, Math.round((index + value / 100) / current.photos.length * 90)));
      photo.mediaId = uploaded.id;
      save();
    }
    await api.media.update(id, photo.mediaId, {
      caption: photo.caption.trim() || null,
      sort_order: index,
      place: photo.place,
      latitude: photo.latitude?.toFixed(6) ?? null,
      longitude: photo.longitude?.toFixed(6) ?? null,
    });
  }
  if (current.stops?.length || current.stopsReviewed) await api.journeys.saveStops(id, (current.stops ?? []).map(stop => ({ id: stop.id, label: stop.label.trim() || stop.place.name, place: stop.place, media_ids: stop.mediaKeys.map(key => current.photos.find(photo => photo.key === key)?.mediaId).filter((value): value is string => Boolean(value)) })));
  progress('Saving cover and photo order…', 94);
  // Reconcile removals, including a photo whose upload response was lost before removal.
  const keep = new Set(current.photos.map(photo => photo.mediaId));
  for (const remote of await api.media.list(id)) {
    if (!keep.has(remote.id)) await api.media.remove(id, remote.id);
  }
  const cover = current.photos.find(photo => photo.key === current.coverKey) ?? current.photos[0];
  await api.media.setCover(id, cover.mediaId!);
  progress('Publishing journey…', 98);
  const published = await api.journeys.updateJourney(id, { visibility: current.values.visibility ?? 'private' });
  if (current.photos.some(photo => photo.type === 'video')) await api.media.shareVideos(id);
  if (published?.id) onPublished?.(published);
  progress('Published', 100);
  return id;
}

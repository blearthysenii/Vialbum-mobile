import { deriveStops, type DraftStop } from './stops';
import type { JourneyInput } from './types';
import type { SelectedPhoto } from '@/features/media/types';
import type { PlaceSelection } from '@/features/places/types';

export type DraftPhoto = SelectedPhoto & {
  requestId: string;
  caption: string;
  place: PlaceSelection | null;
  mediaId?: string;
  needsImport?: boolean;
  unavailable?: boolean;
};
export type JourneyDraft = {
  version: 1;
  requestId: string;
  journeyId?: string;
  step: 'select' | 'photos' | 'details';
  updatedAt?: string;
  completed?: boolean;
  uploadStarted?: boolean;
  values: JourneyInput;
  photos: DraftPhoto[];
  coverKey: string | null;
  stops?: DraftStop[];
  stopsReviewed?: boolean;
};
// A client retry key, not an authentication credential.
export function requestId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  });
}
export function newJourneyDraft(): JourneyDraft {
  const date = new Date();
  const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { version: 1, requestId: requestId(), step: 'select', photos: [], coverKey: null,
    values: { title: '', destination: '', country: '', start_date: today, end_date: today, description: null, latitude: null, longitude: null, visibility: 'private' } };
}
export function detailsError(values: JourneyInput) {
  if (![values.title, values.destination, values.country].every(value => value.trim())) return 'Add a title, destination, and country.';
  if (values.end_date < values.start_date) return 'End date must be on or after the start date.';
  return null;
}
export function movePhoto(photos: DraftPhoto[], key: string, offset: number) {
  const next = [...photos];
  const index = next.findIndex(photo => photo.key === key);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= next.length) return photos;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
export function removeDraftPhoto(draft: JourneyDraft, key: string): JourneyDraft {
  const photos = draft.photos.filter(photo => photo.key !== key);
  return { ...draft, photos, coverKey: draft.coverKey === key ? photos[0]?.key ?? null : draft.coverKey };
}

export function photoIdentity(photo: SelectedPhoto) {
  return photo.libraryId ?? photo.key;
}
// The legacy Expo iOS media-library bridge exports coordinates as strings.
// Also normalize persisted drafts created before that bridge mismatch was handled.
export function mediaCoordinate(value: unknown, limit: number): number | undefined {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? number : undefined;
}
export function normalizeDraft(draft: JourneyDraft): JourneyDraft {
  draft = { ...draft, photos: draft.photos.map(photo => ({ ...photo,
    latitude: mediaCoordinate(photo.latitude, 90), longitude: mediaCoordinate(photo.longitude, 180),
  })) };
  const coverKey = draft.photos.some(photo => photo.key === draft.coverKey) ? draft.coverKey : draft.photos[0]?.key ?? null;
  const step = ['select', 'photos', 'details'].includes(draft.step) ? draft.step : 'select';
  return { ...draft, stops: draft.stopsReviewed ? (draft.stops ?? []).map(stop => ({ ...stop, mediaKeys: stop.mediaKeys.filter(key => draft.photos.some(photo => photo.key === key)) })) : deriveStops(draft.photos, requestId).map(stop => ({ ...stop, id: draft.stops?.find(old => old.place.provider === stop.place.provider && old.place.provider_place_id === stop.place.provider_place_id)?.id ?? stop.id })), coverKey, step: !draft.photos.length && step === 'details' ? 'select' : step };
}

import { publishedMomentForGrids, beginMomentDeletion, momentGridEpoch } from './gridCache';
import type { VideoEdit } from '@/features/media/videoEdit';
import { apiRequest, apiUpload, type UploadFile } from '@/api/client';
import type { PlaceSelection } from '@/features/places/types';
import type { FeedFilter, Moment, MomentPage, MomentPlace } from './types';
const deletions = new Map<string, Promise<void>>();
export const momentsApi = {
  drafts: (signal?: AbortSignal) => apiRequest<Moment[]>('/moments/drafts', { authenticated: true, signal }),
  page: (filter: FeedFilter, cursor?: string | null, signal?: AbortSignal, lightweight = false) => {
    const query = new URLSearchParams({ limit: '12', ...(lightweight ? { include_context: 'false' } : {}) });
    if (cursor) query.set('cursor', cursor);
    Object.entries(filter).forEach(([key, value]) => { if (key !== 'saved' && value) query.set(key, String(value)); });
    return apiRequest<MomentPage>(`/moments/${filter.saved ? 'saved' : 'feed'}?${query}`, { authenticated: true, signal });
  },
  get: (id: string, signal?: AbortSignal) => apiRequest<Moment>(`/moments/${id}`, { authenticated: true, signal }),
  create: (body: { request_id: string; place: PlaceSelection; journey_id?: string; caption: string; visibility: 'public' | 'private'; audio_muted: boolean; captured_at?: string; trim_start_seconds?: number; trim_end_seconds?: number; cover_time_seconds?: number }) => apiRequest<Moment>('/moments', { method: 'POST', authenticated: true, body }),
  upload: (id: string, file: UploadFile, coverTime: number, progress: (n: number) => void, signal: AbortSignal, edit?: VideoEdit) => apiUpload<Moment>(`/moments/${id}/video`, file, { cover_time: String(coverTime), ...(edit ? { trim_start: String(edit.trimStart), trim_end: String(edit.trimEnd) } : {}) }, progress, { signal, timeoutMs: 300000, mediaLabel: 'video' }),
  publish: (id: string) => {
    const epoch = momentGridEpoch();
    return apiRequest<Moment>(`/moments/${id}/publish`, { method: 'POST', authenticated: true }).then(item => { if (epoch === momentGridEpoch()) publishedMomentForGrids(item); return item; });
  },
  save: (id: string, saved: boolean) => apiRequest<Moment>(`/moments/${id}/save`, { method: saved ? 'POST' : 'DELETE', authenticated: true }),
  delete: (id: string) => {
    const key = `${momentGridEpoch()}:${id}`;
    const pending = deletions.get(key); if (pending) return pending;
    const settle = beginMomentDeletion(id);
    const work = apiRequest<void>(`/moments/${id}`, { method: 'DELETE', authenticated: true })
      .then(() => { settle(true); }).catch(error => { settle(false); throw error; })
      .finally(() => { if (deletions.get(key) === work) deletions.delete(key); });
    deletions.set(key, work); return work;
  },
  place: (id: string, signal?: AbortSignal) => apiRequest<MomentPlace>(`/moments/places/${id}`, { authenticated: true, signal }),
  teleport: (current: Moment | undefined, excluded: string[], signal?: AbortSignal, lightweight = false) => {
    const query = new URLSearchParams();
    if (current) { query.set('country_code', current.place.country_code); query.set('place_id', current.place.id); }
    excluded.slice(-24).forEach(id => query.append('exclude_ids', id));
    return apiRequest<Moment>(`/moments/teleport?${query}`, { authenticated: true, signal });
  },
};
export function countryFlag(code: string) { return /^[A-Z]{2}$/.test(code) ? String.fromCodePoint(...[...code].map(c => 127397 + c.charCodeAt(0))) : ''; }

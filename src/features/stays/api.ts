import { ApiError, apiRequest, apiUpload } from '@/api/client';
import type { Place, PlaceSelection } from '@/features/places/types';
export type StayPlace = Place & { category: string | null; address: string | null };
export type StaySelection = PlaceSelection & { category?: string; address?: string | null };
export type AccommodationType = 'hotel' | 'apartment' | 'hostel' | 'guest_house' | 'resort' | 'motel' | 'villa' | 'other';
export type BookingSource = 'airbnb' | 'booking_com' | 'direct' | 'hotel_website' | 'expedia' | 'hostelworld' | 'other' | 'prefer_not_to_say';
export type StayPhoto = { id: string; url: string; position: number };
export type StayTip = { name: string; accommodation_type: AccommodationType; booking_source: BookingSource | null; photos: StayPhoto[]; location: Place | null; manual: boolean; place: StayPlace | null; published: boolean; id: string; tip: string | null; own: boolean; creator: { id: string; username: string; display_name: string; avatar_url: string | null }; journey: { id: string; title: string; destination: string; public: boolean; month?: string }; cover_url: string | null };
export type Stay = { accommodation_type?: AccommodationType; booking_source?: BookingSource | null; photos?: StayPhoto[]; location?: Place | null; id: string; name: string; city: string | null; category: string | null; manual: boolean; place: StayPlace | null; traveler_count: number; cover_url: string | null; tips: StayTip[]; next_offset?: number | null };
export type StayPoint = { id: string; name: string; latitude: number; longitude: number };
export type StayPage = { journey_items?: Stay[]; destinations: { name: string; country: string; latitude: string | null; longitude: string | null }[]; items: Stay[]; areas: { name: string; stay_count: number }[]; next_offset: number | null };
export type StayInput = { request_id?: string; draft?: boolean; accommodation_type?: AccommodationType; booking_source?: BookingSource | null; manual_location?: PlaceSelection; place?: StaySelection; manual_name?: string; manual_city?: string; tip?: string; cover_media_id?: string | null };
const request = async <T,>(path: string, options: Parameters<typeof apiRequest<T>>[1] = {}) => {
  try { return await apiRequest<T>(path, { ...options, authenticated: true }); }
  catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__ && error instanceof ApiError) {
      // Exclude response bodies, credentials, search text and signed media URLs.
      console.warn('[Stays]', options.method ?? 'GET', path.split('?')[0], { status: error.status });
    }
    throw error;
  }
};
export const staysApi = {
  list: (journey: string, offset = 0, signal?: AbortSignal) => request<StayPage>(`/journeys/${encodeURIComponent(journey)}/stays?offset=${offset}`, { signal }),
  detail: (id: string, offset = 0, signal?: AbortSignal, journey?: string) => request<Stay>(`/stays/${encodeURIComponent(id)}?offset=${offset}${journey ? `&journey_id=${encodeURIComponent(journey)}` : ''}`, { signal }),
  search: (journey: string, q: string, destination: number, signal?: AbortSignal) => request<StaySelection[]>(`/places/accommodations?journey_id=${encodeURIComponent(journey)}&q=${encodeURIComponent(q)}&destination_index=${destination}`, { signal }),
  add: (journey: string, body: StayInput) => request<StayTip>(`/journeys/${encodeURIComponent(journey)}/stays`, { method: 'POST', body }),
  owner: (id: string) => request<StayTip>(`/stay-recommendations/${encodeURIComponent(id)}`),
  publish: (id: string) => request<StayTip>(`/stay-recommendations/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  upload: (id: string, file: { uri: string; name: string; mimeType: string; request_id: string; replace_id?: string }, progress: (value: number) => void) => apiUpload<StayPhoto>(`/stay-recommendations/${encodeURIComponent(id)}/photos`, { uri: file.uri, name: file.name, type: file.mimeType }, { request_id: file.request_id, ...(file.replace_id ? { replace_id: file.replace_id } : {}) }, progress),
  deletePhoto: (id: string, photo: string) => request<void>(`/stay-recommendations/${encodeURIComponent(id)}/photos/${encodeURIComponent(photo)}`, { method: 'DELETE' }),
  order: (id: string, ids: string[]) => request<StayPhoto[]>(`/stay-recommendations/${encodeURIComponent(id)}/photos/order`, { method: 'PUT', body: { ids } }),
  edit: (id: string, tip: string | Partial<StayInput> & { name?: string }) => request<StayTip>(`/stay-recommendations/${encodeURIComponent(id)}`, { method: 'PATCH', body: typeof tip === 'string' ? { tip } : tip }),
  remove: (id: string) => request<void>(`/stay-recommendations/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
export function stayPoint(stay: Stay): StayPoint | null {
  const location = stay.location ?? stay.place;
  if (!location) return null;
  const latitude = Number(location.latitude), longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { id: stay.id, name: stay.name, latitude, longitude } : null;
}
export function stayCategory(category: string | null) {
  return category?.startsWith('accommodation.') ? category.slice(14).replace(/_/g, ' ').replace(/^./, character => character.toUpperCase()) : 'Stay';
}

export const accommodationTypes: Record<AccommodationType, string> = { hotel: 'Hotel', apartment: 'Apartment', hostel: 'Hostel', guest_house: 'Guest house', resort: 'Resort', motel: 'Motel', villa: 'Villa', other: 'Other' };
export const bookingSources: Record<BookingSource, string> = { airbnb: 'Airbnb', booking_com: 'Booking.com', direct: 'Direct with property', hotel_website: 'Hotel website', expedia: 'Expedia', hostelworld: 'Hostelworld', other: 'Other', prefer_not_to_say: "I don’t remember / Prefer not to say" };
export function bookedVia(source?: BookingSource | null) { return source && source !== 'prefer_not_to_say' ? `Booked via ${bookingSources[source]}` : null; }

export function stayPoints(stays: Stay[]): StayPoint[] { const points = new Map<string, StayPoint>(); for (const stay of stays) { const point = stayPoint(stay); if (point) points.set(point.id, point); } return [...points.values()]; }

import type { Place, PlaceSelection } from '@/features/places/types';

export type JourneyMedia = {
  id: string;
  journey_id: string;
  memory_id: string | null;
  place_id: string | null;
  place: Place | null;
  type: 'photo' | 'video';
  url: string;
  thumbnail_url: string | null;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  captured_at: string | null;
  latitude: string | null;
  longitude: string | null;
  sort_order: number;
  caption: string | null;
  created_at: string;
};

export type MediaUpdate = {
  caption?: string | null;
  captured_at?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  place?: PlaceSelection | null;
  memory_id?: string | null;
};

export type SelectedPhoto = {
  key: string;
  uri: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
};

export type JourneyMedia = {
  id: string;
  journey_id: string;
  memory_id: string | null;
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
  created_at: string;
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

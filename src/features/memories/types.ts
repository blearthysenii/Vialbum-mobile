import type { Place, PlaceSelection } from '@/features/places/types';

export type Memory = {
  id: string;
  journey_id: string;
  title: string;
  caption: string | null;
  memory_date: string;
  latitude: string | null;
  longitude: string | null;
  place_id: string | null;
  place: Place | null;
  created_at: string;
  updated_at: string;
};

export type MemoryInput = Pick<Memory, 'title' | 'caption' | 'memory_date' | 'latitude' | 'longitude'> & {
  place?: PlaceSelection | null;
};

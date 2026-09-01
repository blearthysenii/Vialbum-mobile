import type { Place, PlaceSelection } from '@/features/places/types';

export type Journey = {
  id: string;
  title: string;
  destination: string;
  country: string;
  start_date: string;
  end_date: string;
  description: string | null;
  latitude: string | null;
  longitude: string | null;
  place_id: string | null;
  place: Place | null;
  cover_media_url: string | null;
  created_at: string;
  updated_at: string;
};

export type JourneyInput = Pick<
  Journey,
  'title' | 'destination' | 'country' | 'start_date' | 'end_date' | 'description' | 'latitude' | 'longitude'
> & { cover_media_url?: string | null; place?: PlaceSelection | null };

export type JourneyUpdate = Partial<JourneyInput>;

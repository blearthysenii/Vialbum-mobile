import type { Journey } from '@/features/journeys/types';
import type { Memory } from '@/features/memories/types';
import type { Place } from '@/features/places/types';

export type PublicCreator = { id: string; username: string; display_name: string; avatar_url: string | null };
export type DiscoverJourney = Journey & {
  is_saved: boolean;
  creator: PublicCreator;
  photo_count: number;
  memory_count: number;
  cover_width: number | null;
  cover_height: number | null;
};
export type DiscoverPage = { items: DiscoverJourney[]; next_cursor: string | null; following_count?: number };
export type PublicPhoto = {
  id: string; memory_id: string | null; caption: string | null;
  url: string; thumbnail_url: string | null; width: number | null; height: number | null;
  captured_at: string | null; created_at: string;
  latitude: string | null; longitude: string | null; place: Place | null;
};
export type PublicJourneyDetail = DiscoverJourney & { memories: Memory[]; photos: PublicPhoto[] };

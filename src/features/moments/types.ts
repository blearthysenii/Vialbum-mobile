import type { Place } from '@/features/places/types';
import type { DiscoverJourney } from '@/features/discover/types';
export type Moment = {
  id: string; creator: { id: string; username: string; display_name: string; avatar_url: string | null };
  place: Place; journey_id: string | null; journey_title: string | null; caption: string | null;
  visibility: 'private' | 'public'; status: 'draft' | 'ready' | 'published' | 'deleting';
  video_url: string | null; cover_url: string | null; duration: number | null; width: number | null; height: number | null;
  trim_start_seconds?: number | null; trim_end_seconds?: number | null; cover_time_seconds?: number | null;
  journey_context?: JourneyContext | null;
  audio_muted: boolean; is_saved: boolean; created_at: string; updated_at: string; feed_cursor: string; media_expires_at: string | null;
};
export type MomentPage = { items: Moment[]; next_cursor: string | null };
export type MomentPlace = { place: Place; journeys: DiscoverJourney[] };
export type FeedFilter = { mode?: 'explore' | 'following'; owner_id?: string; place_id?: string; saved?: boolean };

export type JourneyContext = { title: string; start_date: string; end_date: string; days: number; country_code: string | null; moment_count: number; place_count: number; final_moment_id: string | null; current_stop_id: string | null; stops: { id: string; label: string; latitude: number; longitude: number }[] };

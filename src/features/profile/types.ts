import type { Journey } from '@/features/journeys/types';
import type { Memory } from '@/features/memories/types';
import type { JourneyMedia } from '@/features/media/types';

export type ProfileJourney = Journey & {
  memories: Memory[];
  media: JourneyMedia[];
};

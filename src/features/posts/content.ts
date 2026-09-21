import type { PostJourney } from './data';

export function postContent(journey: PostJourney, active: number, memoryId?: string) {
  // Retain photo scope for existing links without loading or displaying a Memory.
  const photos = memoryId ? journey.photos.filter(item => item.memory_id === memoryId) : journey.photos;
  const index = Math.max(0, Math.min(photos.length - 1, active));
  const photo = photos[index];
  const caption = photo?.caption?.trim() || null;
  const journeyDescription = journey.description?.trim() || null;
  return { photos, index, photo, photoCaption: caption, journeyDescription };
}

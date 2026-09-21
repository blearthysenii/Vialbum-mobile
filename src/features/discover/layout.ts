import type { DiscoverJourney } from './types';

export function discoverAspectRatio(journey: Pick<DiscoverJourney, 'id' | 'cover_width' | 'cover_height'>): number {
  // Stable dimensions prevent recycled cards changing height as images load.
  const seed = [...journey.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return [0.72, 0.86, 0.78, 0.94, 0.82][seed % 5];
}

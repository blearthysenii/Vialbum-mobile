import { clearDiscoverCache } from '@/features/discover/cache';
import { clearSavedJourneyState } from '@/features/savedJourneys/cache';
import { clearFollowState } from '@/features/follows/cache';
import { clearWorldCaches } from '@/features/world/cache';
import { Image } from 'expo-image';

import { recentSearchStorage } from '@/features/search/storage';

export async function clearPrivateLocalData() {
  clearWorldCaches();
  clearDiscoverCache();
  clearSavedJourneyState();
  clearFollowState();
  await Promise.allSettled([
    recentSearchStorage.clear(),
    Image.clearMemoryCache(),
    Image.clearDiskCache(),
  ]);
}

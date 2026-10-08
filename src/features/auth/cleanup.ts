import { clearPublicProfileCache } from '@/features/publicProfile/cache';
import { clearProfileDataCache } from '@/features/profile/dataCache';
import { clearMomentGridCache } from '@/features/moments/gridCache';
import { clearJourneyDrafts } from '@/features/journeys/draftStorage';
import { clearDiscoverCache } from '@/features/discover/cache';
import { clearSavedJourneyState } from '@/features/savedJourneys/cache';
import { clearFollowState } from '@/features/follows/cache';
import { clearWorldCaches } from '@/features/world/cache';
import { Image } from 'expo-image';
import { clearDecodedThumbnails } from '@/features/media/decodedThumbnailCache';

import { recentSearchStorage } from '@/features/search/storage';

export async function clearPrivateLocalData() {
  clearPublicProfileCache();
  clearDecodedThumbnails();
  clearProfileDataCache();
  clearMomentGridCache();
  clearWorldCaches();
  clearDiscoverCache();
  clearSavedJourneyState();
  clearFollowState();
  await Promise.allSettled([
    Promise.resolve().then(clearJourneyDrafts),
    recentSearchStorage.clear(),
    Image.clearMemoryCache(),
    Image.clearDiskCache(),
  ]);
}

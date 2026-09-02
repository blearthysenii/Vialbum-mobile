import { Image } from 'expo-image';

import { recentSearchStorage } from '@/features/search/storage';

export async function clearPrivateLocalData() {
  await Promise.allSettled([
    recentSearchStorage.clear(),
    Image.clearMemoryCache(),
    Image.clearDiskCache(),
  ]);
}

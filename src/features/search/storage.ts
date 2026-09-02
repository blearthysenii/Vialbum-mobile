import * as SecureStore from 'expo-secure-store';

import { normalizeRecentSearches } from '@/features/search/utils';

const RECENT_SEARCHES_KEY = 'vialbum.recent_searches';

export const recentSearchStorage = {
  async get() {
    const stored = await SecureStore.getItemAsync(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    try {
      return normalizeRecentSearches(JSON.parse(stored));
    } catch {
      return [];
    }
  },
  set: (queries: string[]) => SecureStore.setItemAsync(RECENT_SEARCHES_KEY, JSON.stringify(queries)),
  clear: () => SecureStore.deleteItemAsync(RECENT_SEARCHES_KEY),
};

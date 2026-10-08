import { followingStoreFor } from '@/features/discover/cache';
import { ownFollowStatsFor, clearFollowStatsCache } from './statsCache';
import { followsApi } from './api';
import { createFollowStore } from './store';
const stores = new Map<string, ReturnType<typeof createFollowStore>>();
export function followStoreFor(id: string) {
  let store = stores.get(id);
  if (!store) {
    store = createFollowStore(followsApi.set, () => {
      const feed = followingStoreFor(id);
      feed.clear(); // Invalidate any request started before the follow mutation committed.
      void feed.refresh();
    }, delta => ownFollowStatsFor(id).beginFollowingChange(delta));
    stores.set(id, store);
  }
  return store;
}
export function clearFollowState() { clearFollowStatsCache(); stores.forEach((store) => store.clear()); stores.clear(); }

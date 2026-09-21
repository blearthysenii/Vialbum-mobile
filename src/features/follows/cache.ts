import { followingStoreFor } from '@/features/discover/cache';
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
    });
    stores.set(id, store);
  }
  return store;
}
export function clearFollowState() { stores.forEach((store) => store.clear()); stores.clear(); }

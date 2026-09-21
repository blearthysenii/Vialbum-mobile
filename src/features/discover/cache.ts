import { discoverApi } from './api';
import { createDiscoverStore } from './store';
import { followsApi } from '@/features/follows/api';

const stores = new Map<string, ReturnType<typeof createDiscoverStore>>();
const followingStores = new Map<string, ReturnType<typeof createDiscoverStore>>();
export function followingStoreFor(userId: string) {
  let store = followingStores.get(userId);
  if (!store) { store = createDiscoverStore(userId, followsApi.feed); followingStores.set(userId, store); }
  return store;
}
export function discoverStoreFor(userId: string) {
  let store = stores.get(userId);
  if (!store) {
    store = createDiscoverStore(userId, discoverApi.page);
    stores.set(userId, store);
  }
  return store;
}
export function clearDiscoverCache() {
  followingStores.forEach((store) => store.clear());
  followingStores.clear();
  stores.forEach((store) => store.clear());
  stores.clear();
}

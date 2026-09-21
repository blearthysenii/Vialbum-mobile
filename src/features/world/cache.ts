import { worldApi } from './api';
import { createWorldStore } from './store';
import { createPhotoStore } from './photos';
const photoStores = new Map<string, ReturnType<typeof createPhotoStore>>();
export function worldPhotosFor(userId: string) {
  let store = photoStores.get(userId);
  if (!store) { store = createPhotoStore(worldApi.photos); photoStores.set(userId, store); }
  return store;
}
const stores = new Map<string, ReturnType<typeof createWorldStore>>();
export function worldStoreFor(userId: string) {
  let store = stores.get(userId);
  if (!store) { store = createWorldStore(worldApi.map); stores.set(userId, store); }
  return store;
}
export function clearWorldCaches() { stores.forEach(store => store.clear()); stores.clear(); photoStores.forEach(store => store.clear()); photoStores.clear(); }

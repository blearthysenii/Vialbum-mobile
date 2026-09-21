import { createSaveStore } from './store';
import { savedJourneysApi } from './api';

const stores = new Map<string, ReturnType<typeof createSaveStore>>();
export function saveStoreFor(userId: string) {
  let store = stores.get(userId);
  if (!store) { store = createSaveStore(savedJourneysApi.set); stores.set(userId, store); }
  return store;
}
export function clearSavedJourneyState() {
  stores.forEach((store) => store.clear());
  stores.clear();
}

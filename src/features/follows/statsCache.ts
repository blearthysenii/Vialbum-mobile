import { createSessionResource } from '@/utils/sessionResource';
import { followsApi, type FollowStats } from './api';

export function createFollowStatsStore(fetch: (signal: AbortSignal) => Promise<FollowStats>) {
  const resource = createSessionResource(fetch, 'follow-stats');
  let pendingMutations = 0;
  let generation = 0;
  return {
    getSnapshot: resource.getSnapshot,
    subscribe: resource.subscribe,
    refresh: (force = false) => pendingMutations ? Promise.resolve(resource.getSnapshot().data) : resource.refresh(force),
    refreshOutcome: (force = false) => pendingMutations ? Promise.resolve({ status: 'cancelled' as const }) : resource.refreshOutcome(force),
    beginFollowingChange(delta: number) {
      const version = generation;
      const applied = resource.getSnapshot().data !== null;
      pendingMutations++;
      resource.update(data => data ? { ...data, following_count: Math.max(0, data.following_count + delta) } : data);
      let settled = false;
      return (success: boolean) => {
        if (settled || version !== generation) return;
        settled = true; pendingMutations--;
        if (!success && applied) resource.update(data => data ? { ...data, following_count: Math.max(0, data.following_count - delta) } : data);
        if (!pendingMutations) void resource.refresh(true);
      };
    },
    clear() { generation++; pendingMutations = 0; resource.clear(); },
  };
}
const stores = new Map<string, ReturnType<typeof createFollowStatsStore>>();
export function ownFollowStatsFor(userId: string) {
  let store = stores.get(userId);
  if (!store) { store = createFollowStatsStore(followsApi.stats); stores.set(userId, store); }
  return store;
}
export function clearFollowStatsCache() { stores.forEach(store => store.clear()); stores.clear(); }

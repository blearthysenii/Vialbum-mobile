import type { RefreshOutcome } from '@/utils/refreshOutcome';
import type { FeedFilter, Moment, MomentPage } from './types';

export type MomentGridState = { items: Moment[]; nextCursor: string | null; loaded: boolean; loading: boolean; loadingMore: boolean; error: string | null; updatedAt: number };
const empty = (): MomentGridState => ({ items: [], nextCursor: null, loaded: false, loading: false, loadingMore: false, error: null, updatedAt: 0 });
export function createMomentGridStore(fetch: (cursor: string | null, signal: AbortSignal) => Promise<MomentPage>, retained: () => boolean = () => true) {
  let state = empty();
  let generation = 0;
  let accountEpoch = 0;
  let activeUsers = 0;
  const itemRevisions = new Map<string, number>();
  const changedItem = (id: string) => itemRevisions.set(id, (itemRevisions.get(id) ?? 0) + 1);
  const removedIds = new Set<string>();
  const itemRequests = new Map<string, Promise<void>>();
  let controller: AbortController | null = null;
  let pending: Promise<void> | null = null;
  let pendingMore = false;
  const outcomes = new WeakMap<Promise<void>, Promise<RefreshOutcome>>();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<MomentGridState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  function request(more: boolean, force = false): Promise<void> {
    if (pending && (more || !pendingMore)) return pending;
    if (more && !state.nextCursor) return Promise.resolve();
    if (!more && !force && state.loaded && Date.now() - state.updatedAt < 60_000) return Promise.resolve();
    controller?.abort(); const current = ++generation;
    controller = new AbortController(); const signal = controller.signal;
    pendingMore = more;
    const versions = new Map(itemRevisions);
    publish({ loading: !more, loadingMore: more, error: null });
    if (__DEV__) console.debug('[Profile lifecycle] request', 'moment-grid', more ? 'pagination' : state.loaded ? 'background' : 'initial');
    let outcome: RefreshOutcome = { status: 'success' };
    const work = fetch(more ? state.nextCursor : null, signal).then(async page => {
      if (current !== generation) { outcome = { status: 'cancelled' }; return; }
      const seen = new Set<string>();
      while (!more && page.next_cursor && page.items.length < state.items.length && !seen.has(page.next_cursor)) {
        seen.add(page.next_cursor);
        const next = await fetch(page.next_cursor, signal);
        if (current !== generation) { outcome = { status: 'cancelled' }; return; }
        page.items = [...page.items, ...next.items]; page.next_cursor = next.next_cursor;
      }
      if (current !== generation) { outcome = { status: 'cancelled' }; return; }
      const incoming = page.items.filter(item => !removedIds.has(item.id));
      const refreshedIds = new Set(incoming.map(item => item.id));
      const boundary = incoming[incoming.length - 1];
      const retained = more ? state.items : state.items.filter(item => {
        if (removedIds.has(item.id) || refreshedIds.has(item.id)) return false;
        if (itemRevisions.get(item.id) !== versions.get(item.id)) return true;
        if (more) return true;
        if (!page.next_cursor) return false;
        // An item pushed below a non-terminal refreshed boundary remains paginatable.
        // Missing items within the refreshed range are removed/unavailable.
        return Boolean(boundary && item.created_at && boundary.created_at &&
          (item.created_at < boundary.created_at || item.created_at === boundary.created_at && item.id < boundary.id));
      });
      const previousById = new Map(state.items.map(item => [item.id, item]));
      const fresh = incoming.map(item => {
        const previous = previousById.get(item.id);
        if (previous && itemRevisions.get(item.id) !== versions.get(item.id)) return previous;
        return previous && JSON.stringify(previous) === JSON.stringify(item) ? previous : item;
      });
      const merged = more ? [...retained, ...fresh] : [...fresh, ...retained];
      const byId = new Map(merged.map(item => [item.id, item]));
      const items = [...byId.values()];
      if (items.every(item => Boolean(item.created_at))) items.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      const nextCursor = page.next_cursor;
      publish({ items: items.length === state.items.length && items.every((item, index) => item === state.items[index]) ? state.items : items, nextCursor, loaded: true, updatedAt: Date.now() });
    }).catch(error => {
      if (current !== generation) { outcome = { status: 'cancelled' }; return; }
      outcome = { status: error?.status === 401 || error?.status === 403 ? 'authorization' : signal.aborted ? 'cancelled' : 'network' };
      if (__DEV__) console.debug('[Profile lifecycle] failed', 'moment-grid');
      publish({ error: state.loaded ? null : error instanceof Error ? error.message : 'Could not load Moments' });
    }).finally(() => { if (current === generation) { pending = null; publish({ loading: false, loadingMore: false }); } });
    outcomes.set(work, work.then(() => outcome));
    pending = work; return work;
  }
  function cancel() { generation++; controller?.abort(); pending = null; publish({ loading: false, loadingMore: false }); }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: (force = false) => request(false, force),
    refreshOutcome: (force = false): Promise<RefreshOutcome> => { const work = request(false, force); return outcomes.get(work) ?? work.then(() => ({ status: 'success' })); },
    hasSubscribers: () => listeners.size > 0,
    isActive: () => activeUsers > 0,
    isRetained: retained,
    retainActive: () => { activeUsers++; return () => { activeUsers = Math.max(0, activeUsers - 1); }; },
    loadMore: () => request(true),
    invalidate: () => { cancel(); publish({ updatedAt: 0 }); },
    upsert: (item: Moment) => {
      changedItem(item.id); removedIds.delete(item.id);
      const items = [item, ...state.items.filter(old => old.id !== item.id)];
      if (items.every(value => Boolean(value.created_at))) items.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      publish({ items, updatedAt: state.loaded ? Date.now() : 0 });
    },
    remove: (id: string) => { changedItem(id); removedIds.add(id); publish({ items: state.items.filter(item => item.id !== id), updatedAt: 0 }); },
    beginRemove: (id: string) => {
      const epoch = accountEpoch;
      const before = state.items;
      const item = before.find(value => value.id === id);
      const index = before.findIndex(value => value.id === id);
      changedItem(id); removedIds.add(id);
      publish({ items: before.filter(value => value.id !== id) });
      let settled = false;
      return (success: boolean) => {
        if (settled || epoch !== accountEpoch) return;
        settled = true;
        if (!success) {
          removedIds.delete(id);
          if (item && !state.items.some(value => value.id === id)) {
            const items = [...state.items];
            const next = before.slice(index + 1).find(value => items.some(current => current.id === value.id));
            const anchor = next ? items.findIndex(value => value.id === next.id) : Math.min(index, items.length);
            items.splice(anchor, 0, item); publish({ items });
          }
        }
      };
    },
    refreshItem: (id: string, load: () => Promise<Moment>) => {
      const pendingItem = itemRequests.get(id); if (pendingItem) return pendingItem;
      const epoch = accountEpoch, revision = itemRevisions.get(id);
      const original = state.items.find(item => item.id === id);
      const work = load().then(item => {
        if (epoch !== accountEpoch || revision !== itemRevisions.get(id) || removedIds.has(id) || state.items.find(value => value.id === id) !== original) return;
        changedItem(id); publish({ items: state.items.map(value => value.id === id ? item : value) });
      })
        .finally(() => { if (itemRequests.get(id) === work) itemRequests.delete(id); });
      itemRequests.set(id, work); return work;
    },
    clear: () => { itemRevisions.clear(); itemRequests.clear(); accountEpoch++; removedIds.clear(); cancel(); state = empty(); listeners.forEach(listener => listener()); },
  };
}
type Entry = { filter: FeedFilter; store: ReturnType<typeof createMomentGridStore> };
const stores = new Map<string, Entry>();
let cacheEpoch = 0;
export const momentGridEpoch = () => cacheEpoch;
export function momentGridFor(viewerId: string, filter: FeedFilter, fetch: (cursor: string | null, signal: AbortSignal) => Promise<MomentPage>) {
  const key = `${viewerId}:${JSON.stringify(filter)}`;
  let entry = stores.get(key);
  if (!entry) { entry = { filter, store: createMomentGridStore(fetch, () => stores.get(key)?.store === entry?.store) }; stores.set(key, entry); }
  stores.delete(key); stores.set(key, entry);
  for (const [id, candidate] of stores) {
    if (stores.size <= 24) break;
    if (id !== key && !candidate.store.isActive()) { candidate.store.clear(); stores.delete(id); }
  }
  return entry.store;
}
export function publishedMomentForGrids(item: Moment) {
  stores.forEach(({ filter, store }) => {
    if (filter.owner_id === item.creator.id && !filter.saved && (!filter.place_id || filter.place_id === item.place.id)) store.upsert(item);
    else store.invalidate();
  });
}
export function deletedMomentFromGrids(id: string) { stores.forEach(({ store }) => store.remove(id)); }
export function clearMomentGridCache() { cacheEpoch++; stores.forEach(({ store }) => store.clear()); stores.clear(); }

export function beginMomentDeletion(id: string) {
  const settlements = [...stores.values()].map(({ store }) => store.beginRemove(id));
  return (success: boolean) => settlements.forEach(settle => settle(success));
}

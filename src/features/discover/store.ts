import type { DiscoverJourney, DiscoverPage } from './types';

export type FeedState = {
  followingCount?: number;
  items: DiscoverJourney[]; nextCursor: string | null; loaded: boolean;
  loading: boolean; loadingMore: boolean; error: string | null; updatedAt: number;
};
const emptyState = (): FeedState => ({ items: [], nextCursor: null, loaded: false, loading: false, loadingMore: false, error: null, updatedAt: 0 });

// A single store per signed-in account: tab changes don't discard the feed.
export function createDiscoverStore(viewerId: string, fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<DiscoverPage>, includeOwnPublic = false) {
  let state = emptyState();
  let generation = 0;
  let controller: AbortController | null = null;
  let pending: Promise<void> | null = null;
  let pendingMore = false;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<FeedState>) => { state = { ...state, ...patch }; listeners.forEach((listener) => listener()); };
  function request(more: boolean): Promise<void> {
    if (pending && (more || !pendingMore)) return pending;
    if (more && !state.nextCursor) return Promise.resolve();
    controller?.abort();
    const current = ++generation;
    controller = new AbortController();
    const signal = controller.signal;
    const cursor = more ? state.nextCursor : null;
    pendingMore = more;
    publish({ loading: !more, loadingMore: more, error: null });
    const work = (async () => {
      try {
        const page = await fetchPage(cursor, signal);
        if (current !== generation) return;
        const visible = page.items.filter((item) => (includeOwnPublic || item.creator.id !== viewerId) && item.visibility === 'public');
        const byId = new Map((more ? state.items : []).map((item) => [item.id, item]));
        visible.forEach((item) => byId.set(item.id, item));
        publish({ items: [...byId.values()], nextCursor: page.next_cursor, followingCount: page.following_count, loaded: true, updatedAt: Date.now() });
      } catch (error) {
        if (current !== generation) return;
        publish({
          ...(more ? {} : { items: [], nextCursor: null, loaded: false }),
          error: error instanceof Error ? error.message : 'Could not load journeys. Please try again.',
        });
      } finally {
        if (current === generation) {
          pending = null;
          publish({ loading: false, loadingMore: false });
        }
      }
    })();
    pending = work;
    return work;
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh: () => request(false),
    loadMore: () => request(true),
    clear: () => { generation += 1; controller?.abort(); pending = null; state = emptyState(); listeners.forEach((listener) => listener()); },
  };
}

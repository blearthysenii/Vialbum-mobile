import type { Journey } from './types';
import type { RefreshOutcome } from '@/utils/refreshOutcome';
export type JourneyPage = { items: Journey[]; next_cursor: string | null; total_count: number };
export function createProfileJourneyStore(fetch: (cursor: string | null, signal: AbortSignal) => Promise<JourneyPage>) {
  const initial = () => ({ items: [] as Journey[], nextCursor: null as string | null, totalCount: 0, loaded: false, loading: false, loadingMore: false, error: null as string | null, updatedAt: 0 });
  let state = initial(), epoch = 0, accountEpoch = 0;
  let pending: Promise<RefreshOutcome> | null = null, pendingMore = false;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>(), revisions = new Map<string, number>(), removed = new Set<string>();
  const publish = (patch: Partial<typeof state>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const change = (id: string) => revisions.set(id, (revisions.get(id) ?? 0) + 1);
  async function request(more: boolean, force = false): Promise<RefreshOutcome> {
    if (pending && (more || !pendingMore)) return pending;
    if (more && !state.nextCursor || !more && !force && state.loaded && Date.now() - state.updatedAt < 60_000) return { status: 'success' };
    controller?.abort(); controller = new AbortController();
    const signal = controller.signal, current = ++epoch, versions = new Map(revisions);
    pendingMore = more;
    publish({ loading: !more, loadingMore: more, error: null });
    const work = (async (): Promise<RefreshOutcome> => {
      try {
        const page = await fetch(more ? state.nextCursor : null, signal);
        if (current !== epoch) return { status: 'cancelled' };
        // Refresh only the already loaded range, preserving it until revalidation completes.
        const seen = new Set<string>();
        while (!more && page.next_cursor && page.items.length < state.items.length && !seen.has(page.next_cursor)) {
          seen.add(page.next_cursor);
          const next = await fetch(page.next_cursor, signal);
          if (current !== epoch) return { status: 'cancelled' };
          page.items = [...page.items, ...next.items]; page.next_cursor = next.next_cursor;
        }
        if (current !== epoch) return { status: 'cancelled' };
        const existing = new Map(state.items.map(item => [item.id, item]));
        const items = new Map((more ? state.items : state.items.filter(item => revisions.get(item.id) !== versions.get(item.id))).map(item => [item.id, item]));
        for (const item of page.items) {
          if (removed.has(item.id)) continue;
          const old = existing.get(item.id);
          items.set(item.id, old && (revisions.get(item.id) !== versions.get(item.id) || JSON.stringify(old) === JSON.stringify(item)) ? old : item);
        }
        const data = [...items.values()].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
        publish({ items: data.length === state.items.length && data.every((item, i) => item === state.items[i]) ? state.items : data, nextCursor: page.next_cursor, totalCount: Math.max(page.total_count, data.length), loaded: true, updatedAt: Date.now() });
        return { status: 'success' };
      } catch (error) {
        if (current !== epoch) return { status: 'cancelled' };
        const status = (error as { status?: number })?.status;
        publish({ error: state.loaded ? null : 'Your journeys could not be loaded. Please try again.' });
        return { status: status === 401 || status === 403 ? 'authorization' : signal.aborted ? 'cancelled' : 'network' };
      } finally { if (current === epoch) { pending = null; publish({ loading: false, loadingMore: false }); } }
    })();
    pending = work; return work;
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    refreshOutcome: (force = false) => request(false, force),
    refresh: async (force = false) => (await request(false, force)).status === 'success' ? state.items : undefined,
    loadMore: () => request(true),
    upsert(item: Journey, created = false) {
      const exists = state.items.some(old => old.id === item.id); removed.delete(item.id); change(item.id);
      publish({ items: [item, ...state.items.filter(old => old.id !== item.id)].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)), totalCount: state.totalCount + (exists || !created ? 0 : 1) });
    },
    beginRemove(id: string) {
      const item = state.items.find(item => item.id === id), current = accountEpoch;
      const existed = Boolean(item); removed.add(id); change(id);
      publish({ items: state.items.filter(item => item.id !== id), totalCount: Math.max(0, state.totalCount - (existed ? 1 : 0)) });
      let settled = false;
      return (success: boolean) => {
        if (settled || current !== accountEpoch) return; settled = true;
        if (!success && item) { removed.delete(id); change(id); publish({ items: [...state.items, item].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)), totalCount: state.totalCount + 1 }); }
      };
    },
    clear() { accountEpoch++; epoch++; controller?.abort(); pending = null; revisions.clear(); removed.clear(); state = initial(); listeners.forEach(fn => fn()); },
  };
}

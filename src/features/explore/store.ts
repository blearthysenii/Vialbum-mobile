import type { Category, SearchResults } from './api';

export const SEARCH_DELAY = 350;
export type SearchState = { query: string; results: SearchResults | null; loading: boolean; more: Category | null; error: string | null };
export function createExploreStore(fetcher: (q: string, type: Category | 'all', cursor: string | null, signal: AbortSignal) => Promise<SearchResults>) {
  let state: SearchState = { query: '', results: null, loading: false, more: null, error: null };
  let version = 0;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SearchState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const cancel = () => { version++; controller?.abort(); if (timer) clearTimeout(timer); timer = null; };
  async function run(type: Category | 'all' = 'all') {
    const q = state.query.trim().replace(/\s+/g, ' ');
    if (q.replace(/^@/, '').length < 2 || q.length > 100) return;
    if (type !== 'all' && (state.loading || state.more || !state.results?.[type].next_cursor)) return;
    if (type === 'all') cancel();
    const current = version;
    controller = new AbortController();
    publish({ loading: type === 'all', more: type === 'all' ? null : type, error: null });
    try {
      const response = await fetcher(q, type, type === 'all' ? null : state.results![type].next_cursor, controller.signal);
      if (version !== current) return;
      if (type === 'all') publish({ results: response });
      else {
        const existing = state.results!;
        const items = [...new Map([...existing[type].items, ...response[type].items].map(item => [item.id, item])).values()];
        publish({ results: { ...existing, [type]: { items, next_cursor: response[type].next_cursor } } });
      }
    } catch {
      if (version === current) publish({ ...(type === 'all' ? { results: null } : {}), error: 'Search is unavailable. Check your connection and try again.' });
    } finally { if (version === current) publish({ loading: false, more: null }); }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setQuery(query: string) {
      cancel();
      publish({ query, results: null, error: null, loading: query.trim().replace(/^@/, '').length >= 2, more: null });
      if (query.trim().replace(/^@/, '').length >= 2) timer = setTimeout(() => void run(), SEARCH_DELAY);
    },
    refresh: () => run(),
    loadMore: (type: Category) => run(type),
    suspend() { cancel(); publish({ results: null, loading: false, more: null, error: null }); },
  };
}

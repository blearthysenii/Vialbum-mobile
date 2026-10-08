import type { Category, SearchResults } from './api';

export const SEARCH_DELAY = 350;
export type SearchState = { revision: number; query: string; category: Category | 'all'; results: SearchResults | null; loading: boolean; more: Category | null; error: string | null };
export function createExploreStore(fetcher: (q: string, type: Category | 'all', cursor: string | null, signal: AbortSignal) => Promise<SearchResults>) {
  let state: SearchState = { revision: 0, query: '', category: 'all', results: null, loading: false, more: null, error: null };
  let version = 0;
  let suspended = false;
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<SearchState>) => { state = { ...state, ...patch }; listeners.forEach(fn => fn()); };
  const cancel = () => { version++; controller?.abort(); if (timer) clearTimeout(timer); timer = null; };
  const valid = (query: string) => !query.trim() || query.trim().replace(/^@/, '').length >= 2 && query.length <= 100;
  async function run(more: Category | null = null) {
    const q = state.query.trim().replace(/\s+/g, ' ');
    if (suspended || !valid(q)) return;
    if (more && (state.loading || state.more || !state.results?.[more]?.next_cursor || state.category !== 'all' && state.category !== more)) return;
    if (!more) cancel();
    const type = more ?? state.category, current = version;
    controller = new AbortController();
    publish({ loading: !more, more, error: null });
    try {
      const response = await fetcher(q, type, more ? state.results![more].next_cursor : null, controller.signal);
      if (version !== current) return;
      if (!more) publish({ results: response, revision: state.revision + 1 });
      else {
        const existing = state.results!;
        const items = [...new Map([...existing[more].items, ...response[more].items].map(item => [item.id, item])).values()];
        publish({ results: { ...existing, [more]: { items, next_cursor: response[more].next_cursor } } });
      }
    } catch {
      if (version === current) publish({ ...(!more ? { results: null } : {}), error: 'Search is unavailable. Check your connection and try again.' });
    } finally { if (version === current) publish({ loading: false, more: null }); }
  }
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    setQuery(query: string) {
      cancel(); publish({ query, results: null, error: null, loading: valid(query), more: null });
      if (!query.trim()) void run();
      else if (valid(query)) timer = setTimeout(() => void run(), SEARCH_DELAY);
    },
    setCategory(category: Category | 'all') {
      if (category === state.category) return;
      cancel(); publish({ category, results: null, error: null, loading: valid(state.query), more: null });
      void run();
    },
    refresh: () => { suspended = false; return run(); },
    resume: () => { suspended = false; return state.results ? Promise.resolve() : run(); },
    loadMore: (type: Category) => run(type),
    suspend(preserve = false) { suspended = true; cancel(); publish({ ...(!preserve ? { results: null } : {}), loading: false, more: null, error: null }); },
  };
}

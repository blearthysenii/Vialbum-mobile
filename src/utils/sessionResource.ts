import type { RefreshOutcome } from './refreshOutcome';
export type ResourceState<T> = { data: T | null; loading: boolean; error: string | null; updatedAt: number };

// Session-owned stale-while-revalidate state, matching the app's custom store architecture.
export function createSessionResource<T>(fetch: (signal: AbortSignal) => Promise<T>, label: string, staleMs = 60_000) {
  let state: ResourceState<T> = { data: null, loading: false, error: null, updatedAt: 0 };
  let version = 0;
  let controller: AbortController | null = null;
  let pending: Promise<T | null> | null = null;
  const outcomes = new WeakMap<Promise<T | null>, Promise<RefreshOutcome>>();
  const listeners = new Set<() => void>();
  const publish = (patch: Partial<ResourceState<T>>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
  function invalidate() {
    version++; controller?.abort(); pending = null;
    publish({ loading: false, updatedAt: 0 });
  }
  function refresh(force = false): Promise<T | null> {
    if (pending) return pending;
    if (!force && state.data !== null && Date.now() - state.updatedAt < staleMs) return Promise.resolve(state.data);
    const current = ++version;
    controller = new AbortController(); const signal = controller.signal;
    publish({ loading: true, error: null });
    if (__DEV__) console.debug('[Profile lifecycle] request', label, state.data === null ? 'initial' : 'background');
    let outcome: RefreshOutcome = { status: 'success' };
    const work = fetch(signal).then(data => {
      if (current !== version) { outcome = { status: 'cancelled' }; return state.data; }
      const same = JSON.stringify(data) === JSON.stringify(state.data);
      publish({ data: same ? state.data : data, updatedAt: Date.now(), error: null });
      return state.data;
    }).catch(error => {
      if (current !== version) { outcome = { status: 'cancelled' }; return state.data; }
      outcome = { httpStatus: error?.status, status: error?.status === 401 || error?.status === 403 ? 'authorization' : signal.aborted ? 'cancelled' : 'network' };
      if (__DEV__) console.debug('[Profile lifecycle] failed', label);
      // Existing good data remains usable even when the network fails.
      publish({ error: state.data === null ? (error instanceof Error ? error.message : 'Could not load data.') : null });
      return state.data;
    }).finally(() => {
      if (current === version) { pending = null; publish({ loading: false }); }
    });
    outcomes.set(work, work.then(() => outcome));
    pending = work; return work;
  }
  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    refreshOutcome: (force = false): Promise<RefreshOutcome> => { const work = refresh(force); return outcomes.get(work) ?? work.then(() => ({ status: 'success' })); },
    hasSubscribers: () => listeners.size > 0,
    invalidate,
    update: (change: (data: T | null) => T | null) => {
      invalidate(); publish({ data: change(state.data), error: null, updatedAt: Date.now() });
    },
    clear: () => { invalidate(); publish({ data: null, error: null, updatedAt: 0 }); },
  };
}

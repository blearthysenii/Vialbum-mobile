export function thumbnailRenewalKey(kind: string, id: string, uri: string | null | undefined) {
  return `${kind}:${id}:${uri?.split(/[?#]/, 1)[0] ?? ''}`;
}
// Account/screen-owned work plus a bounded recovery budget, never a permanent failure set.
export function createUrlRenewalCoordinator(wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)), scope = '') {
  const pending = new Map<string, Promise<void>>();
  const cycles = new Map<string, { startedAt: number; count: number }>();
  let epoch = 0;
  return {
    run(key: string, renew: () => Promise<unknown>) {
      const identity = key.split(':').slice(0, 2).join(':');
      const trace = (event: string, attempt?: number) => { if (typeof __DEV__ !== 'undefined' && __DEV__) console.debug('[Profile thumbnail renewal]', event, { identity, attempt }); };
      key = `${scope}:${key}`;
      const existing = pending.get(key); if (existing) { trace('deduplicated'); return existing; }
      const previous = cycles.get(key);
      const budget = previous && Date.now() - previous.startedAt < 60_000 ? previous : { startedAt: Date.now(), count: 0 };
      if (budget.count >= 3) return Promise.reject(new Error('Thumbnail recovery limit reached. Retry explicitly.'));
      budget.count++; cycles.delete(key); cycles.set(key, budget);
      while (cycles.size > 128) cycles.delete(cycles.keys().next().value!);
      const current = epoch;
      const work = (async () => {
        for (let attempt = 0; attempt < 3 && current === epoch; attempt++) {
          try { trace('API request', attempt + 1); await renew(); trace('API completion', attempt + 1); return; }
          catch (error) {
            const status = (error as { status?: number })?.status;
            if (current !== epoch || status === 401 || status === 403 || status === 404 || attempt === 2) throw error;
            await wait(500 * 2 ** attempt);
          }
        }
      })().finally(() => { if (pending.get(key) === work) pending.delete(key); });
      pending.set(key, work); return work;
    },
    reset(key: string) { cycles.delete(`${scope}:${key}`); },
    clear() { epoch++; pending.clear(); cycles.clear(); },
  };
}

export type SaveState = { saved: boolean; pending: boolean; error: string | null };

// Account-scoped optimistic overrides shared by every mounted journey card/detail.
export function createSaveStore(mutate: (id: string, saved: boolean) => Promise<void>) {
  let entries: ReadonlyMap<string, SaveState> = new Map();
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (id: string, value: SaveState) => {
    entries = new Map(entries).set(id, value);
    listeners.forEach((listener) => listener());
  };
  return {
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => entries,
    async toggle(id: string, initial: boolean) {
      const before = entries.get(id);
      if (before?.pending) return;
      const saved = before?.saved ?? initial;
      const current = generation;
      publish(id, { saved: !saved, pending: true, error: null });
      try {
        await mutate(id, !saved);
        if (current === generation) publish(id, { saved: !saved, pending: false, error: null });
      } catch {
        if (current === generation) publish(id, { saved, pending: false, error: 'Could not update Saved. Try again.' });
      }
    },
    clear() { generation++; entries = new Map(); listeners.forEach((listener) => listener()); },
  };
}

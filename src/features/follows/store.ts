export type FollowState = { following: boolean; pending: boolean; error: string | null };
export function createFollowStore(mutate: (id: string, following: boolean) => Promise<void>, changed: () => void, beginCountChange?: (delta: number) => (success: boolean) => void) {
  let state: ReadonlyMap<string, FollowState> = new Map();
  let generation = 0;
  const listeners = new Set<() => void>();
  const publish = (id: string, entry: FollowState) => { state = new Map(state).set(id, entry); listeners.forEach((fn) => fn()); };
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    async toggle(id: string, initial: boolean) {
      if (state.get(id)?.pending) return;
      const before = state.get(id)?.following ?? initial;
      const current = generation;
      const settleCount = beginCountChange?.(before ? -1 : 1);
      publish(id, { following: !before, pending: true, error: null });
      try {
        await mutate(id, !before);
        if (current !== generation) return;
        publish(id, { following: !before, pending: false, error: null });
        settleCount?.(true);
        changed();
      } catch {
        if (current === generation) { settleCount?.(false); publish(id, { following: before, pending: false, error: 'Could not update follow. Try again.' }); }
      }
    },
    clear() { generation++; state = new Map(); listeners.forEach((fn) => fn()); },
  };
}

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState } from 'react-native';
import { momentGridFor } from './gridCache';
import { momentsApi } from './api';

// The Profile's virtualized list owns rendering; this hook owns only its
// existing account-scoped collection. Selection loads a cold cache once.
export function useProfileMoments(userId: string | undefined, active: boolean) {
  const [focusEpoch, setFocusEpoch] = useState(0);
  useFocusEffect(useCallback(() => { setFocusEpoch(value => value + 1); }, []));
  // Focus reacquires a canonical store if inactive retention evicted this mounted screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focusEpoch intentionally rechecks the external cache
  const store = useMemo(() => momentGridFor(userId ?? 'signed-out', { owner_id: userId }, (cursor, signal) => momentsApi.page({ owner_id: userId }, cursor, signal, true)), [userId, focusEpoch]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const activeRef = useRef(active); activeRef.current = active;
  const attempted = useRef<typeof store | null>(null);
  useEffect(() => {
    if (userId && active && attempted.current !== store) {
      attempted.current = store;
      if (!store.getSnapshot().loaded) void store.refresh();
    }
  }, [userId, active, store]);
  useFocusEffect(useCallback(() => {
    const release = store.retainActive?.();
    const cached = store.getSnapshot();
    if (userId && activeRef.current && cached.loaded && Date.now() - cached.updatedAt >= 60_000) void store.refresh();
    return release;
  }, [userId, store]));
  useEffect(() => {
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active' && userId && active && store.getSnapshot().loaded) void store.refresh();
      previous = next;
    });
    return () => listener.remove();
  }, [userId, active, store]);
  return { store, state };
}

import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { ownFollowStatsFor } from './statsCache';

export function useOwnFollowStats() {
  const { user } = useAuth();
  const store = useMemo(() => ownFollowStatsFor(user?.id ?? 'signed-out'), [user?.id]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const refresh = useCallback(async () => { if (user?.id) return store.refreshOutcome(true); }, [store, user?.id]);
  useFocusEffect(useCallback(() => {
    if (user?.id && store.getSnapshot().data === null) void store.refresh();
    // Navigation blur is not a data invalidation event.
  }, [store, user?.id]));
  useEffect(() => {
    let previous = AppState.currentState;
    const listener = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active' && user?.id && store.getSnapshot().data !== null) void store.refresh();
      previous = next;
    });
    return () => listener.remove();
  }, [store, user?.id]);
  return { stats: state.data, error: state.error, loading: state.loading && state.data === null, refresh };
}

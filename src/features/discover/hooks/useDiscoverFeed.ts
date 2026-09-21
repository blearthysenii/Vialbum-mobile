import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { discoverStoreFor, followingStoreFor } from '../cache';

export function useDiscoverFeed(mode: 'discover' | 'following' = 'discover') {
  const { user } = useAuth();
  const userId = user?.id;
  const store = useMemo(() => mode === 'following' ? followingStoreFor(userId ?? '') : discoverStoreFor(userId ?? ''), [userId, mode]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useFocusEffect(useCallback(() => {
    // Keep the two Home modes cached, but revalidate public content after navigation.
    return () => {
      discoverStoreFor(userId ?? '').clear();
      followingStoreFor(userId ?? '').clear();
    };
  }, [userId]));
  useFocusEffect(useCallback(() => {
    if (userId && !store.getSnapshot().loaded) void store.refresh();
  }, [store, userId]));
  useEffect(() => {
    if (userId && state.updatedAt && Date.now() - state.updatedAt > 60_000) void store.refresh();
  }, [store, userId, state.updatedAt]);
  return { ...state, refresh: store.refresh, loadMore: store.loadMore };
}

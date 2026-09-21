import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { saveStoreFor } from './cache';

export function useSavedJourneys() {
  const { user } = useAuth();
  const store = useMemo(() => saveStoreFor(user?.id ?? ''), [user?.id]);
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { entries, toggle: store.toggle, userId: user?.id };
}

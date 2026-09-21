import { useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { followStoreFor } from './cache';
export function useFollows() {
  const { user } = useAuth();
  const store = useMemo(() => followStoreFor(user?.id ?? ''), [user?.id]);
  const entries = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { entries, toggle: store.toggle, userId: user?.id };
}

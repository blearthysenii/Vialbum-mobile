import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { followsApi, type FollowStats } from './api';

export function useOwnFollowStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<FollowStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    if (!user?.id) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(null);
    try {
      const result = await followsApi.stats(controller.signal);
      if (!controller.signal.aborted) setStats(result);
    } catch {
      if (!controller.signal.aborted) { setStats(null); setError('Could not load your follow counts. Tap to retry.'); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [user?.id]);
  useFocusEffect(useCallback(() => {
    setStats(null);
    void refresh();
    return () => { request.current?.abort(); setStats(null); };
  }, [refresh]));
  return { stats, error, loading, refresh };
}

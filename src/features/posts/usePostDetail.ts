import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/api/client';
import type { AuthUser } from '@/features/auth/types';
import { loadPost, type PostJourney } from './data';
import { consumePostEdit } from './editReturn';

export function usePostDetail(id: string, own: boolean, user: AuthUser | null) {
  const identity = JSON.stringify([user?.id, id, own]);
  const [snapshot, setSnapshot] = useState<{ identity: string; post: PostJourney } | null>(null);
  const [failure, setFailure] = useState<{ identity: string; message: string } | null>(null);
  const [fetching, setFetching] = useState(false);
  const [revision, setRevision] = useState(0);
  const loaded = useRef(snapshot);
  const requestedRevision = useRef(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    const existing = loaded.current?.identity === identity;
    const explicitRefresh = revision !== requestedRevision.current;
    requestedRevision.current = revision;
    const editChanged = consumePostEdit(id);
    if (!user || (existing && editChanged === false && !explicitRefresh)) return;

    setFetching(true);
    setFailure(null);
    void loadPost(id, own, user, controller.signal).then(post => {
      if (controller.signal.aborted) return;
      const next = { identity, post };
      loaded.current = next;
      setSnapshot(next);
    }).catch((caught: unknown) => {
      if (controller.signal.aborted) return;
      const unavailable = caught instanceof ApiError && [401, 403, 404].includes(caught.status);
      if (unavailable) {
        // Never retain content after access has been revoked or the post deleted.
        loaded.current = null;
        setSnapshot(null);
      }
      setFailure({ identity, message: unavailable
        ? 'This post is no longer available. It may be private or deleted.'
        : caught instanceof Error ? caught.message : 'Could not open this post.' });
    }).finally(() => {
      if (!controller.signal.aborted) setFetching(false);
    });
    return () => { controller.abort(); setFetching(false); };
  }, [id, own, user, identity, revision]));

  const journey = user && snapshot?.identity === identity ? snapshot.post : null;
  const error = failure?.identity === identity ? failure.message : null;
  return { journey, error, refresh, initialLoading: !journey && !error, refreshing: Boolean(journey && fetching) };
}

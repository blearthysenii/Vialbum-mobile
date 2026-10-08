import { createProfileJourneyStore } from './profileStore';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type SetStateAction } from 'react';

import { mediaApi } from '@/features/media/api';

import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { journeyApi } from '@/features/journeys/api';
import { invalidateProfileMedia } from '@/features/profile/dataCache';
import { clearPreparedJourneyDetails } from '@/features/journeys/detailsCache';
import type { Journey, JourneyInput, JourneyUpdate } from '@/features/journeys/types';

type JourneyContextValue = {
  profileStore: ReturnType<typeof createProfileJourneyStore>;
  ensureAll: () => void;
  journeys: Journey[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<Journey[] | undefined>;
  applyPublished: (journey: Journey) => void;
  fetchOne: (id: string) => Promise<Journey>;
  create: (input: JourneyInput) => Promise<Journey>;
  update: (id: string, input: JourneyUpdate) => Promise<Journey>;
  remove: (id: string) => Promise<void>;
  setCover: (id: string, mediaId: string) => Promise<Journey>;
};

const EMPTY_JOURNEYS: Journey[] = [];
const JourneyContext = createContext<JourneyContextValue | null>(null);

function journeyErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 0) return error.message;
  return 'Your journeys could not be loaded. Please try again.';
}

export function JourneyProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const profileStore = useMemo(() => createProfileJourneyStore((cursor, signal) => userId ? journeyApi.page(cursor, signal) : Promise.resolve({ items: [], next_cursor: null, total_count: 0 })), [userId]);
  useEffect(() => () => profileStore.clear(), [profileStore]);
  const allAttempted = useRef<{ userId: string; at: number } | null>(null);
  const accountScope = useRef(userId); accountScope.current = userId;
  const refreshRequest = useRef<{ userId: string; promise: Promise<Journey[] | undefined> } | null>(null);
  const journeyRevision = useRef(0);
  const pendingMutations = useRef(0);
  const mutationScope = useRef(userId);
  const sessionEpoch = useRef(0);
  if (mutationScope.current !== userId) {
    mutationScope.current = userId;
    allAttempted.current = null;
    sessionEpoch.current++;
    journeyRevision.current++;
    pendingMutations.current = 0;
    refreshRequest.current = null;
  }
  const epoch = sessionEpoch.current;
  const [journeyState, setJourneyState] = useState<{ userId: string | undefined; data: Journey[] }>({ userId, data: [] });
  const journeys = journeyState.userId === userId ? journeyState.data : EMPTY_JOURNEYS;
  const setJourneys = useCallback((change: SetStateAction<Journey[]>) => {
    setJourneyState(current => {
      const previous = current.userId === accountScope.current ? current.data : [];
      const next = typeof change === 'function' ? change(previous) : change;
      const byId = new Map(previous.map(item => [item.id, item]));
      const data = next.map(item => { const old = byId.get(item.id); return old && JSON.stringify(old) === JSON.stringify(item) ? old : item; });
      return current.userId === accountScope.current && data.length === previous.length && data.every((item, index) => item === previous[index]) ? current : { userId: accountScope.current, data };
    });
  }, []);
  const cachedJourneys = useRef(journeys); cachedJourneys.current = journeys;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve(undefined);
    if (pendingMutations.current) return Promise.resolve(cachedJourneys.current);
    const revision = journeyRevision.current;
    if (refreshRequest.current?.userId === userId) return refreshRequest.current.promise;
    setError(null);
    if (__DEV__) console.debug('[Profile lifecycle] request', 'journeys', cachedJourneys.current.length ? 'background' : 'initial');
    const promise = journeyApi.fetchJourneys().then(refreshedJourneys => {
      if (accountScope.current === userId && revision === journeyRevision.current) setJourneys(refreshedJourneys);
      return refreshedJourneys;
    }).catch(caughtError => {
      if (accountScope.current === userId && revision === journeyRevision.current && !cachedJourneys.current.length) setError(journeyErrorMessage(caughtError));
      return undefined;
    }).finally(() => { if (refreshRequest.current?.promise === promise) refreshRequest.current = null; });
    refreshRequest.current = { userId, promise };
    return promise;
  }, [userId, setJourneys]);

  useEffect(() => {
    if (!userId) {
      clearPreparedJourneyDetails();
      setJourneys([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    // Full collections are loaded lazily by legacy consumers, not by Profile.
  }, [refresh, userId, setJourneys, epoch]);

  const ensureAll = useCallback(() => {
    if (!userId || allAttempted.current?.userId === userId && Date.now() - allAttempted.current.at < 60_000) return;
    allAttempted.current = { userId, at: Date.now() };
    const owner = userId, initialEpoch = epoch;
    setIsLoading(true);
    void refresh().finally(() => { if (accountScope.current === owner && sessionEpoch.current === initialEpoch) setIsLoading(false); });
  }, [userId, epoch, refresh]);

  const beginMutation = useCallback(() => {
    journeyRevision.current++;
    refreshRequest.current = null;
    pendingMutations.current++;
    const owner = userId;
    const startedEpoch = epoch;
    return { owner, active: () => accountScope.current === owner && sessionEpoch.current === startedEpoch, finish: () => { if (accountScope.current === owner && sessionEpoch.current === startedEpoch) pendingMutations.current = Math.max(0, pendingMutations.current - 1); } };
  }, [userId, epoch]);

  const fetchOne = useCallback(async (id: string) => {
    const owner = userId;
    const revision = journeyRevision.current;
    const journey = await journeyApi.fetchJourney(id);
    if (accountScope.current === owner && revision === journeyRevision.current && !pendingMutations.current) { profileStore.upsert(journey); setJourneys(current => current.some(item => item.id === journey.id)
      ? current.map(item => item.id === journey.id ? journey : item) : [journey, ...current]); }
    return journey;
  }, [userId, setJourneys, profileStore]);

  const applyPublished = useCallback((journey: Journey) => {
    if (!userId || accountScope.current !== userId || sessionEpoch.current !== epoch) return;
    journeyRevision.current++; refreshRequest.current = null;
    profileStore.upsert(journey, true);
    setJourneys(current => [journey, ...current.filter(item => item.id !== journey.id)]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)));
  }, [userId, setJourneys, epoch, profileStore]);

  const create = useCallback(async (input: JourneyInput) => {
    const mutation = beginMutation();
    try {
      const journey = await journeyApi.createJourney(input);
      if (mutation.active()) { profileStore.upsert(journey, true); setJourneys(current => [journey, ...current.filter(item => item.id !== journey.id)]); }
      return journey;
    } finally { mutation.finish(); }
  }, [beginMutation, setJourneys, profileStore]);

  const update = useCallback(async (id: string, input: JourneyUpdate) => {
    const mutation = beginMutation();
    try {
      const journey = await journeyApi.updateJourney(id, input);
      if (mutation.active()) {
        profileStore.upsert(journey);
        setJourneys(current => current.map(item => item.id === id ? journey : item));
        if (mutation.owner) invalidateProfileMedia(mutation.owner, id);
      }
      return journey;
    } finally { mutation.finish(); }
  }, [beginMutation, setJourneys, profileStore]);

  const setCover = useCallback(async (id: string, mediaId: string) => {
    const mutation = beginMutation();
    try {
      const journey = await mediaApi.setCover(id, mediaId);
      if (mutation.active()) {
        profileStore.upsert(journey);
        setJourneys(current => current.some(item => item.id === id) ? current.map(item => item.id === id ? journey : item) : [journey, ...current]);
        if (mutation.owner) invalidateProfileMedia(mutation.owner, id);
        clearPreparedJourneyDetails(id);
      }
      return journey;
    } finally { mutation.finish(); }
  }, [beginMutation, setJourneys, profileStore]);

  const removalRequests = useRef(new Map<string, Promise<void>>());
  const remove = useCallback((id: string) => {
    const key = `${epoch}:${userId}:${id}`;
    const pending = removalRequests.current.get(key); if (pending) return pending;
    const work = (async () => {
      const mutation = beginMutation();
      const settleProfile = profileStore.beginRemove(id);
      const before = cachedJourneys.current;
      const deleted = before.find(item => item.id === id);
      if (mutation.active()) setJourneys(current => current.filter(item => item.id !== id));
      try {
        await journeyApi.deleteJourney(id);
        settleProfile(true);
        if (mutation.owner) invalidateProfileMedia(mutation.owner, id);
      } catch (error) {
        settleProfile(false);
        if (mutation.active() && deleted) setJourneys(current => {
          if (current.some(item => item.id === id)) return current;
          const restored = [...current];
          const next = before.slice(before.findIndex(item => item.id === id) + 1).find(item => restored.some(row => row.id === item.id));
          const index = next ? restored.findIndex(item => item.id === next.id) : restored.length;
          restored.splice(index, 0, deleted); return restored;
        });
        throw error;
      } finally { mutation.finish(); }
    })().finally(() => { if (removalRequests.current.get(key) === work) removalRequests.current.delete(key); });
    removalRequests.current.set(key, work); return work;
  }, [beginMutation, setJourneys, userId, epoch, profileStore]);

  const value = useMemo(
    () => ({ profileStore, ensureAll, journeys, isLoading, error, refresh, fetchOne, applyPublished, create, update, remove, setCover }),
    [profileStore, ensureAll, applyPublished, create, error, fetchOne, isLoading, journeys, refresh, remove, update, setCover],
  );
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourneys({ paginated = false }: { paginated?: boolean } = {}) {
  const context = useContext(JourneyContext);
  if (!context) throw new Error('useJourneys must be used inside JourneyProvider');
  const store = context.profileStore;
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const ensureAll = context.ensureAll;
  useEffect(() => { if (!paginated) ensureAll(); }, [paginated, ensureAll]);
  useFocusEffect(useCallback(() => { if (paginated) void store.refresh(); else ensureAll(); }, [store, paginated, ensureAll]));
  useEffect(() => {
    if (!paginated) return;
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active' && previous !== 'active') void store.refresh();
      previous = next;
    });
    return () => subscription.remove();
  }, [store, paginated]);
  return paginated ? { ...context, journeys: state.items, isLoading: state.loading && !state.loaded, error: state.error, totalCount: state.totalCount, loadingMore: state.loadingMore, loadMore: store.loadMore, refresh: () => store.refresh(true), refreshOutcome: () => store.refreshOutcome(true) }
    : { ...context, totalCount: context.journeys.length, loadingMore: false, loadMore: store.loadMore, refreshOutcome: store.refreshOutcome };
}

import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { journeyApi } from '@/features/journeys/api';
import type { Journey, JourneyInput, JourneyUpdate } from '@/features/journeys/types';

type JourneyContextValue = {
  journeys: Journey[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  fetchOne: (id: string) => Promise<Journey>;
  create: (input: JourneyInput) => Promise<Journey>;
  update: (id: string, input: JourneyUpdate) => Promise<Journey>;
  remove: (id: string) => Promise<void>;
};

const JourneyContext = createContext<JourneyContextValue | null>(null);

function journeyErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 0) return error.message;
  return 'Your journeys could not be loaded. Please try again.';
}

export function JourneyProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      setJourneys(await journeyApi.fetchJourneys());
    } catch (caughtError) {
      setError(journeyErrorMessage(caughtError));
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setJourneys([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void refresh().finally(() => setIsLoading(false));
  }, [refresh, user]);

  const fetchOne = useCallback(async (id: string) => {
    const journey = await journeyApi.fetchJourney(id);
    setJourneys((current) => {
      const exists = current.some((item) => item.id === journey.id);
      return exists
        ? current.map((item) => (item.id === journey.id ? journey : item))
        : [journey, ...current];
    });
    return journey;
  }, []);

  const create = useCallback(async (input: JourneyInput) => {
    const journey = await journeyApi.createJourney(input);
    setJourneys((current) => [journey, ...current]);
    return journey;
  }, []);

  const update = useCallback(async (id: string, input: JourneyUpdate) => {
    const journey = await journeyApi.updateJourney(id, input);
    setJourneys((current) => current.map((item) => (item.id === id ? journey : item)));
    return journey;
  }, []);

  const remove = useCallback(async (id: string) => {
    await journeyApi.deleteJourney(id);
    setJourneys((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({ journeys, isLoading, error, refresh, fetchOne, create, update, remove }),
    [create, error, fetchOne, isLoading, journeys, refresh, remove, update],
  );
  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>;
}

export function useJourneys() {
  const context = useContext(JourneyContext);
  if (!context) throw new Error('useJourneys must be used inside JourneyProvider');
  return context;
}

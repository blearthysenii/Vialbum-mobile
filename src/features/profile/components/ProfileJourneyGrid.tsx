import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, PixelRatio, Platform, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { JourneyThumbnailImage } from '@/features/media/components/JourneyThumbnailImage';
import { StableCachedImage } from '@/features/media/components/StableCachedImage';
import { useFocusEffect } from 'expo-router';
import { listDrafts } from '@/features/journeys/draftStorage';
import type { ProfileJourney } from '@/features/profile/types';
import type { ProfileTheme } from '@/features/profile/theme';

export function ProfileJourneyGrid({ userId, journeys, theme, width, loading, onOpen }: {
  userId: string; journeys: ProfileJourney[]; theme: ProfileTheme; width: number;
  loading: boolean; onOpen: (journey: ProfileJourney) => void;
}) {
  const published = usePublishedProfileJourneys(userId, journeys);
  const size = Math.max(0, (width - 4) / 3);
  return <View style={styles.grid}>
    {published.map(journey => <JourneyThumbnail key={journey.id} journey={journey} size={size} placeholder={theme.placeholder} onOpen={onOpen} />)}
    {loading && !published.length ? <ActivityIndicator color={theme.muted} style={styles.loading} /> : null}
  </View>;
}
export function journeyThumbnailSource(journey: ProfileJourney) {
  const photo = journey.media.find(item => item.type === 'photo');
  return journey.cover_media_url ?? photo?.thumbnail_url ?? photo?.url ?? null;
}
export const JourneyThumbnail = memo(function JourneyThumbnail({ journey, size, placeholder, onOpen, onImageError, onImageLoad, onImageRetry, cacheScope }: {
  onImageLoad?: (journey: ProfileJourney) => void; onImageRetry?: (journey: ProfileJourney) => void; cacheScope?: string; onImageError?: (journey: ProfileJourney) => void; journey: ProfileJourney; size: number; placeholder: string; onOpen: (journey: ProfileJourney) => void;
}) {
  const source = journeyThumbnailSource(journey);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const failed = Boolean(source && failedSource === source);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${journey.title}`} onPress={() => onOpen(journey)} style={{ width: size, height: size, backgroundColor: placeholder }}>
    {source && cacheScope && Platform.OS !== 'web' ? <JourneyThumbnailImage key={journey.id} cacheScope={cacheScope} uri={source} namespace={`journey.album.cover:${journey.id}`} pixelSize={size * PixelRatio.get()} retryToken={retryToken}
      onSourceError={() => onImageError?.(journey)} onError={() => setFailedSource(source)} onLoad={() => { setFailedSource(null); onImageLoad?.(journey); }} /> : source ? <StableCachedImage key={journey.id} cacheScope={cacheScope} retryToken={retryToken} uri={source} namespace={`journey.album.cover:${journey.id}`} onSourceError={() => onImageError?.(journey)} onError={() => setFailedSource(source)} onLoad={() => { setFailedSource(null); onImageLoad?.(journey); }} style={StyleSheet.absoluteFill} /> : null}
    {failed ? <Pressable accessibilityRole="button" accessibilityLabel={`Retry thumbnail for ${journey.title}`} onPress={event => {
      event.stopPropagation(); onImageRetry?.(journey); setFailedSource(null); setRetryToken(value => value + 1);
    }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="refresh-outline" size={24} color="#666666" /></Pressable> : null}
  </Pressable>;
});
const styles = StyleSheet.create({
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 2 },
  loading: { width: '100%', paddingVertical: 24 },
});

export function usePublishedProfileJourneys(userId: string | undefined, journeys: ProfileJourney[], onDraftCount?: (count: number) => void) {
  const readIds = useCallback(() => {
    try { return userId ? listDrafts(userId).flatMap(draft => draft.journeyId ? [draft.journeyId] : []) : []; }
    catch { return []; }
  }, [userId]);
  const [draftState, setDraftState] = useState(() => ({ owner: userId, ids: readIds() }));
  // Never apply another account's draft exclusions, even during the effect gap.
  const unfinishedIds = useMemo(() => draftState.owner === userId ? draftState.ids : readIds(), [draftState, userId, readIds]);
  useFocusEffect(useCallback(() => {
    // An interrupted publish can already have a server Journey ID. Keep that
    // unfinished entry in the existing drafts experience, outside this grid.
    try {
      const ids = userId ? listDrafts(userId).flatMap(draft => draft.journeyId ? [draft.journeyId] : []) : [];
      setDraftState(previous => previous.owner === userId && JSON.stringify(previous.ids) === JSON.stringify(ids) ? previous : { owner: userId, ids });
    } catch { /* Retain the last known draft exclusions if storage is unavailable. */ }
  }, [userId]));
  useEffect(() => { onDraftCount?.(new Set(unfinishedIds).size); }, [unfinishedIds, onDraftCount]);
  return useMemo(() => journeys.filter(journey => !unfinishedIds.includes(journey.id)), [journeys, unfinishedIds]);
}

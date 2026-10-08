import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { publicProfileFor } from './cache';
import { requireRefreshSuccess } from '@/utils/refreshOutcome';
import { MomentGrid, ProfileMediaTabs } from '@/features/moments/MomentGrid';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useAuth } from '@/features/auth/AuthProvider';
import { DiscoverJourneyCard } from '@/features/discover/components/DiscoverJourneyCard';
import { DiscoverError, DiscoverSkeletons } from '@/features/discover/components/DiscoverFeedback';
import { createDiscoverStore } from '@/features/discover/store';
import { albumDates, JourneyAlbumCard } from '@/features/profile/components/TravelProfileContent';
import { PublicProfileHeader } from './PublicProfileHeader';
import { useProfileTheme } from '@/features/profile/theme';
import { savedJourneysApi } from '@/features/savedJourneys/api';
import { useSavedJourneys } from '@/features/savedJourneys/useSavedJourneys';

// Both collections reuse Discover's pagination, card rendering and request cancellation.
export function PublicJourneyCollection({ ownerId }: { ownerId?: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { user } = useAuth();
  const theme = useProfileTheme();
  const reduceMotion = useReducedMotion();
  const { entries } = useSavedJourneys();
  const [collection, setCollection] = useState<'journeys' | 'moments'>('journeys');
  const [profileFailure, setProfileFailure] = useState<string | null>(null);
  const [focusEpoch, setFocusEpoch] = useState(0);
  useFocusEffect(useCallback(() => { setFocusEpoch(value => value + 1); }, []));
  // Focus reacquires a canonical store if inactive retention evicted this mounted screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focusEpoch intentionally rechecks the external cache
  const retained = useMemo(() => publicProfileFor(user?.id ?? 'signed-out', ownerId ?? 'saved'), [user?.id, ownerId, focusEpoch]);
  const identity = useSyncExternalStore(retained.identity.subscribe, retained.identity.getSnapshot, retained.identity.getSnapshot);
  const profile = identity.data, profileError = identity.error || profileFailure;
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  const store = useMemo(() => ownerId ? retained.journeys : createDiscoverStore(user?.id ?? '', savedJourneysApi.page), [ownerId, user?.id, retained]);
  const feed = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const loadProfile = useCallback(async (force = false) => {
    if (ownerId) {
      const result = await retained.identity.refreshOutcome(force);
      if (result.status === 'authorization' || result.httpStatus === 404) { retained.identity.clear(); retained.journeys.clear(); setProfileFailure('This profile is unavailable.'); }
      else if (result.status === 'success') setProfileFailure(null);
      else if (force && result.status !== 'cancelled') setProfileFailure('This profile could not be refreshed. Please try again.');
      return result;
    }
  }, [ownerId, retained]);
  useFocusEffect(useCallback(() => {
    const release = retained.retainActive();
    if (retained.isRetained()) { void loadProfile(retry > 0); void store.refresh(retry > 0); }
    return release;
    // Blur preserves the viewer/owner cache; session cleanup owns invalidation.
  }, [loadProfile, store, retry, retained]));
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.all([store.refresh(true), loadProfile(true)]); }
    finally { setRefreshing(false); }
  };
  const items = ownerId ? feed.items : feed.items.filter((item) => entries.get(item.id)?.saved ?? item.is_saved);
  const open = useCallback((id: string) => router.push({ pathname: '/post/[id]', params: { id, scope: 'public' } }), []);
  const error = profileError || feed.error;
  return <SafeAreaView edges={ownerId && profile ? ['bottom'] : ['top', 'bottom']} style={[styles.screen, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
    {!(ownerId && profile) ? <View style={styles.nav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
      <Text numberOfLines={1} style={presentationTextStyle([styles.navTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{ownerId ? profile?.username ?? 'Public profile' : 'Saved Journeys'}</Text>
      <View style={styles.back} />
    </View> : null}
    {ownerId && collection === 'moments' ? <MomentGrid filter={{ owner_id: ownerId }} onRefreshProfile={async () => requireRefreshSuccess(await loadProfile(true))} header={<View>{profile ? <PublicProfileHeader profile={profile} sectionTitle={null} /> : null}<ProfileMediaTabs selected={collection} onChange={setCollection} />{profileError ? <DiscoverError message={profileError} theme={theme} onRetry={() => setRetry(value => value + 1)} /> : null}</View>} /> : <FlashList data={items} masonry={!ownerId} numColumns={2} keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => ownerId ? <View style={{ paddingLeft: index % 2 === 0 ? 20 : 8, paddingRight: index % 2 === 0 ? 8 : 20 }}><JourneyAlbumCard fullWidth reduceMotion={reduceMotion} journey={{ ...item, memories: [], media: [] }} theme={theme} date={albumDates(item)} index={index} onPress={() => open(item.id)} /></View> : <DiscoverJourneyCard journey={item} theme={theme} onOpen={open} />}
      contentContainerStyle={ownerId ? { paddingBottom: 40 } : styles.content} maintainVisibleContentPosition={{ disabled: true }}
      ListHeaderComponent={<View>
        {ownerId && profile ? <><PublicProfileHeader profile={profile} sectionTitle={null} /><ProfileMediaTabs selected={collection} onChange={setCollection} /></> : null}
        {error ? <DiscoverError message={error} theme={theme} onRetry={() => setRetry((value) => value + 1)} /> : null}
      </View>}
      ListEmptyComponent={!feed.loaded && !error ? <DiscoverSkeletons theme={theme} /> : !error ? <View style={styles.empty}>
        <Ionicons name={ownerId ? 'compass-outline' : 'bookmark-outline'} size={32} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />
        <Text style={presentationTextStyle([styles.emptyTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{ownerId ? 'No public journeys yet.' : 'Save journeys that inspire you.'}</Text>
        <Text style={presentationTextStyle([styles.emptyCopy, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{ownerId ? 'Shared travel stories will appear here.' : "They’ll appear here for easy access later."}</Text>
      </View> : null}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator style={styles.loader} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}
      onEndReached={() => { if (!feed.loading && !feed.loadingMore && !feed.error) void store.loadMore(); }}
      onEndReachedThreshold={0.6} alwaysBounceVertical
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={resolvePresentationColor(theme.muted, 'tintColor', 'content')} colors={resolvePresentationColor([theme.muted], 'colors', 'content')} />}
    />}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, nav: { height: 54, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 9, paddingTop: 12, paddingBottom: 32 },
  identity: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 }, avatar: { width: 86, height: 86, borderRadius: 43 },
  name: { fontSize: 25, fontWeight: '600', letterSpacing: -0.6, marginTop: 15 }, username: { fontSize: 14, marginTop: 6 },
  bio: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 12 }, count: { fontSize: 13, marginTop: 18 },
  section: { fontSize: 21, fontWeight: '600', alignSelf: 'flex-start', marginTop: 28, marginBottom: 18 },
  empty: { alignItems: 'center', paddingHorizontal: 25, paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 19, fontWeight: '600', textAlign: 'center' }, emptyCopy: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, loader: { padding: 20 },
});
const presentationBaselineStyles = styles;

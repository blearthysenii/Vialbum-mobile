import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
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
import { publicProfileApi, type PublicProfile } from './api';

// Both collections reuse Discover's pagination, card rendering and request cancellation.
export function PublicJourneyCollection({ ownerId }: { ownerId?: string }) {
  const { user } = useAuth();
  const theme = useProfileTheme();
  const reduceMotion = useReducedMotion();
  const { entries } = useSavedJourneys();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [retry, setRetry] = useState(0);
  const profileRequest = useRef<AbortController | null>(null);
  const store = useMemo(() => createDiscoverStore(user?.id ?? '',
    ownerId ? (cursor, signal) => publicProfileApi.journeys(ownerId, cursor, signal) : savedJourneysApi.page,
    Boolean(ownerId)), [ownerId, user?.id]);
  const feed = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const loadProfile = useCallback(async () => {
    if (!ownerId) return;
    profileRequest.current?.abort();
    const controller = new AbortController();
    profileRequest.current = controller;
    setProfileError(null);
    try {
      const next = await publicProfileApi.get(ownerId, controller.signal);
      if (!controller.signal.aborted) setProfile(next);
    } catch {
      if (!controller.signal.aborted) { setProfile(null); setProfileError('This profile could not be loaded. Please try again.'); }
    }
  }, [ownerId]);
  useFocusEffect(useCallback(() => {
    void loadProfile();
    void store.refresh();
    return () => { profileRequest.current?.abort(); store.clear(); };
    // Retry intentionally restarts both requests, even when the route is unchanged.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadProfile, store, retry]));
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await Promise.all([store.refresh(), loadProfile()]); }
    finally { setRefreshing(false); }
  };
  const items = ownerId ? feed.items : feed.items.filter((item) => entries.get(item.id)?.saved ?? item.is_saved);
  const open = useCallback((id: string) => router.push({ pathname: '/post/[id]', params: { id, scope: 'public' } }), []);
  const error = profileError || feed.error;
  return <SafeAreaView edges={ownerId && profile ? ['bottom'] : ['top', 'bottom']} style={[styles.screen, { backgroundColor: theme.canvas }]}>
    {!(ownerId && profile) ? <View style={styles.nav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.back}><Ionicons name="chevron-back" size={25} color={theme.ink} /></Pressable>
      <Text numberOfLines={1} style={[styles.navTitle, { color: theme.ink }]}>{ownerId ? profile?.username ?? 'Public profile' : 'Saved Journeys'}</Text>
      <View style={styles.back} />
    </View> : null}
    <FlashList data={items} masonry={!ownerId} numColumns={2} keyExtractor={(item) => item.id}
      renderItem={({ item, index }) => ownerId ? <View style={{ paddingLeft: index % 2 === 0 ? 20 : 8, paddingRight: index % 2 === 0 ? 8 : 20 }}><JourneyAlbumCard fullWidth reduceMotion={reduceMotion} journey={{ ...item, memories: [], media: [] }} theme={theme} date={albumDates(item)} index={index} onPress={() => open(item.id)} /></View> : <DiscoverJourneyCard journey={item} theme={theme} onOpen={open} />}
      contentContainerStyle={ownerId ? { paddingBottom: 40 } : styles.content} maintainVisibleContentPosition={{ disabled: true }}
      ListHeaderComponent={<View>
        {ownerId && profile ? <PublicProfileHeader profile={profile} /> : null}
        {error ? <DiscoverError message={error} theme={theme} onRetry={() => setRetry((value) => value + 1)} /> : null}
      </View>}
      ListEmptyComponent={!feed.loaded && !error ? <DiscoverSkeletons theme={theme} /> : !error ? <View style={styles.empty}>
        <Ionicons name={ownerId ? 'compass-outline' : 'bookmark-outline'} size={32} color={theme.subtle} />
        <Text style={[styles.emptyTitle, { color: theme.ink }]}>{ownerId ? 'No public journeys yet.' : 'Save journeys that inspire you.'}</Text>
        <Text style={[styles.emptyCopy, { color: theme.muted }]}>{ownerId ? 'Shared travel stories will appear here.' : "They’ll appear here for easy access later."}</Text>
      </View> : null}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator style={styles.loader} color={theme.muted} /> : null}
      onEndReached={() => { if (!feed.loading && !feed.loadingMore && !feed.error) void store.loadMore(); }}
      onEndReachedThreshold={0.6} alwaysBounceVertical
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.muted} colors={[theme.muted]} />}
    />
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

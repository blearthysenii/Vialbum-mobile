import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { VialbumWordmark } from '@/components/VialbumWordmark';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { useProfileTheme } from '@/features/profile/theme';
import { useDiscoverFeed } from '../hooks/useDiscoverFeed';
import { DiscoverJourneyCard } from './DiscoverJourneyCard';
import { DiscoverEmptyState, DiscoverError, DiscoverSkeletons } from './DiscoverFeedback';

export function DiscoverFeed() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [mode, setMode] = useState<'discover' | 'following'>('discover');
  const feed = useDiscoverFeed(mode);
  const theme = useProfileTheme();
  const insets = useSafeAreaInsets();
  const tabBarScroll = useTabBarScroll();
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const hold = useSharedValue(0);
  const holdStyle = useAnimatedStyle(() => ({ height: hold.value }));
  const open = useCallback((id: string) => router.push({ pathname: '/post/[id]', params: { id, scope: 'public' } }), []);

  async function pullToRefresh() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    const start = Date.now();
    hold.set(reduceMotion ? 56 : withTiming(56, { duration: 180, easing: Easing.out(Easing.cubic) }));
    try { await feed.refresh(); }
    finally {
      const remaining = 600 - (Date.now() - start);
      if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      setRefreshing(false);
      refreshingRef.current = false;
      hold.set(reduceMotion ? 0 : withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) }));
    }
  }
  const empty = !feed.loaded && !feed.error ? <DiscoverSkeletons theme={theme} />
    : !feed.error ? mode === 'discover' ? <DiscoverEmptyState theme={theme} /> : <View style={styles.followEmpty}><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{feed.followingCount === 0 ? 'Follow travelers to see their journeys here.' : 'No new journeys from people you follow.'}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), textAlign: 'center', marginTop: 10 })}>Discover people and trips you like, then follow them.</Text></View> : null;

  return <View style={[styles.screen, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
    <FlashList
      key={mode}
      {...tabBarScroll}
      data={feed.items}
      masonry
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <DiscoverJourneyCard journey={item} theme={theme} onOpen={open} />}
      maintainVisibleContentPosition={{ disabled: true }}
      contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 9, paddingBottom: insets.bottom + 110 }}
      ListHeaderComponent={<View>
        <Animated.View pointerEvents="none" style={holdStyle} />
        <View style={styles.brand}><VialbumWordmark width={118} height={34} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><Pressable accessibilityRole="button" accessibilityLabel="Search places and journeys" onPress={() => router.push('/explore')} style={{ position: 'absolute', right: 12, minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="search-outline" size={24} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable></View>
        <View style={styles.heading}>
          {(['discover', 'following'] as const).map((tab) => <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: mode === tab }} disabled={refreshing} onPress={() => setMode(tab)} style={styles.tab}><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(mode === tab ? theme.ink : theme.subtle, 'color', 'content') }])}>{tab === 'discover' ? 'Discover' : 'Following'}</Text>{mode === tab ? <View style={[styles.indicator, { backgroundColor: resolvePresentationColor(theme.ink, 'backgroundColor', 'content') }]} /> : null}</Pressable>)}
        </View>
        {feed.error && !feed.items.length ? <DiscoverError message={feed.error} theme={theme} onRetry={() => void feed.refresh()} /> : null}
      </View>}
      ListEmptyComponent={empty}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator style={styles.footer} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : feed.error && feed.items.length ? <DiscoverError message={feed.error} theme={theme} onRetry={() => void feed.refresh()} /> : null}
      onEndReached={() => { if (!feed.loading && !feed.loadingMore && !feed.error) void feed.loadMore(); }}
      onEndReachedThreshold={0.6}
      alwaysBounceVertical
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={pullToRefresh} progressViewOffset={insets.top + 8} tintColor={resolvePresentationColor(theme.muted, 'tintColor', 'content')} colors={resolvePresentationColor([theme.muted], 'colors', 'content')} />}
    />
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, brand: { alignItems: 'center', marginBottom: 18 },
  heading: { flexDirection: 'row', justifyContent: 'center', gap: 36, paddingBottom: 14 },
  tab: { minHeight: 40, justifyContent: 'center', paddingBottom: 9 },
  title: { fontSize: 17, lineHeight: 23, fontWeight: '500', letterSpacing: -0.3 },
  indicator: { height: 2, borderRadius: 1, position: 'absolute', bottom: 0, left: 0, right: 0 },
  footer: { padding: 22 },
  followEmpty: { padding: 30, paddingVertical: 70, alignItems: 'center' },
});
const presentationBaselineStyles = styles;

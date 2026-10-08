import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { createUrlRenewalCoordinator, thumbnailRenewalKey } from '@/utils/urlRenewal';
import { requireRefreshSuccess, summarizeRefresh } from '@/utils/refreshOutcome';
import Animated from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StableCachedImage } from '@/features/media/components/StableCachedImage';
import { router, useFocusEffect } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { momentGridFor } from './gridCache';
import { useProfileTheme } from '@/features/profile/theme';
import { momentsApi } from './api';
import type { FeedFilter, Moment } from './types';
export { ProfileMediaTabs } from '@/features/profile/components/ProfileMediaTabs';
export function MomentGrid({ filter, header, active = true, bottomPadding = 40, onScroll, hideRefreshIndicator = false, onRefreshingChange, onRefreshProfile, requestRefresh, registerRefreshAction, embedded = false, embeddedWidth = 0, registerLoadMore }: { embeddedWidth?: number; embedded?: boolean; registerLoadMore?: (action: (() => void) | null) => void; filter: FeedFilter; active?: boolean; registerRefreshAction?: (action: (() => void) | null) => void; requestRefresh?: (action: () => void) => void; header?: ReactElement; bottomPadding?: number; hideRefreshIndicator?: boolean; onRefreshProfile?: () => Promise<void>; onRefreshingChange?: (refreshing: boolean) => void; onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const { user } = useAuth();
  const key = JSON.stringify(filter);
  const [focusEpoch, setFocusEpoch] = useState(0);
  useFocusEffect(useCallback(() => { setFocusEpoch(value => value + 1); }, []));
  // Focus reacquires a canonical store if inactive retention evicted this mounted screen.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- focusEpoch intentionally rechecks the external cache
  const store = useMemo(() => momentGridFor(user?.id ?? 'signed-out', JSON.parse(key), (cursor, signal) => momentsApi.page(JSON.parse(key), cursor, signal, true)), [key, user?.id, focusEpoch]);
  const renewals = useMemo(() => createUrlRenewalCoordinator(undefined, user?.id), [user?.id]);
  useEffect(() => () => renewals.clear(), [renewals]);
  const recoverImage = useCallback((item: Moment) => {
    void renewals.run(thumbnailRenewalKey('moment', item.id, item.cover_url), () => store.refreshItem(item.id, () => momentsApi.get(item.id))).catch(() => {
      if (__DEV__) console.warn('[Profile thumbnail] Moment URL renewal failed', { id: item.id });
    });
  }, [store, renewals]);
  const imageDisplayed = useCallback((item: Moment) => renewals.reset(thumbnailRenewalKey('moment', item.id, item.cover_url)), [renewals]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const { items, loaded, error, loadingMore } = state;
  const initialLoading = state.loading && !loaded;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  useEffect(() => { onRefreshingChange?.(refreshing); }, [refreshing, onRefreshingChange]);
  const refreshAction = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled([store.refreshOutcome(true).then(requireRefreshSuccess), ...(onRefreshProfile ? [onRefreshProfile()] : [])]).then(results => {
      const outcome = summarizeRefresh(results);
      setRefreshError(outcome === 'success' || outcome === 'cancelled' ? null : outcome === 'partial' ? 'Some profile information could not be refreshed. Please try again.' : 'Could not refresh. Please try again.');
    }).finally(() => setRefreshing(false));
  }, [store, onRefreshProfile]);
  useEffect(() => { registerRefreshAction?.(refreshAction); return () => registerRefreshAction?.(null); }, [registerRefreshAction, refreshAction]);
  const activeRef = useRef(active); activeRef.current = active;
  const attemptedStore = useRef<typeof store | null>(null);
  useEffect(() => {
    if (active && user?.id && attemptedStore.current !== store) {
      attemptedStore.current = store;
      if (!store.getSnapshot().loaded) void store.refresh();
    }
  }, [active, store, user?.id]);
  // Collection selection is deliberately absent from focus dependencies.
  useFocusEffect(useCallback(() => {
    const release = activeRef.current ? store.retainActive?.() : undefined;
    if (activeRef.current && user?.id && store.isRetained?.() !== false) void store.refresh();
    return release;
  }, [store, user?.id]));
  useEffect(() => { registerLoadMore?.(() => { void store.loadMore(); }); return () => registerLoadMore?.(null); }, [registerLoadMore, store]);
  const renderTile = useCallback(({ item }: { item: Moment }) => <MomentTile key={item.id} cacheScope={user?.id} onImageError={recoverImage} onImageLoad={imageDisplayed} item={item} ownerId={filter.owner_id} placeId={filter.place_id} saved={filter.saved} placeholder={theme.placeholder} embeddedWidth={embedded ? embeddedWidth : 0} />, [embedded, embeddedWidth, filter.owner_id, filter.place_id, filter.saved, theme.placeholder, user?.id, recoverImage, imageDisplayed]);
  const empty = <View style={styles.empty}>{initialLoading ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), textAlign: 'center' })}>{error || "Share a moment from somewhere you've been."}</Text>{error ? <Pressable onPress={() => void store.refresh(true)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), marginTop: 15 })}>Retry</Text></Pressable> : null}</>}</View>;
  const footer = loadingMore && items.length ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={{ margin: 25 }} /> : null;
  if (embedded) return <View style={{ paddingBottom: bottomPadding }}>{header}<View style={styles.embeddedGrid}>{items.length ? items.map(item => renderTile({ item })) : empty}</View>{footer}</View>;
  return <Animated.FlatList contentInsetAdjustmentBehavior={onScroll ? 'never' : undefined} automaticallyAdjustContentInsets={onScroll ? false : undefined} onScroll={onScroll} scrollEventThrottle={16} data={items} numColumns={3} keyExtractor={item => item.id} ListHeaderComponent={<View>{header}{refreshError ? <Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content'), textAlign: 'center', padding: 16 })}>{refreshError}</Text> : null}</View>} contentContainerStyle={{ paddingBottom: bottomPadding }}
    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { if (requestRefresh) requestRefresh(refreshAction); else refreshAction(); }} tintColor={resolvePresentationColor(hideRefreshIndicator ? 'transparent' : theme.muted, 'tintColor', 'content')} colors={resolvePresentationColor(hideRefreshIndicator ? ['transparent'] : undefined, 'colors', 'content')} progressBackgroundColor={hideRefreshIndicator ? 'transparent' : undefined} />}
    renderItem={renderTile}
    ListEmptyComponent={empty}
    ListFooterComponent={footer}
    onEndReached={() => { if (active) void store.loadMore(); }} onEndReachedThreshold={0.5} />;
}
export const MomentTile = memo(function MomentTile({ item, ownerId, placeId, saved, placeholder, embeddedWidth, onImageError, onImageLoad, cacheScope }: { onImageLoad?: (item: Moment) => void; cacheScope?: string; onImageError?: (item: Moment) => void; item: Moment; ownerId?: string; placeId?: string; saved?: boolean; placeholder: string; embeddedWidth: number }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  // In the auto-height wrapping scene, Yoga can stretch an aspect-ratio-only
  // cell to zero height even while its grid reserves the full row. Derive the
  // explicit cell height from the same width/aspect ratio as the existing list.
  return <Pressable style={[styles.tile, embeddedWidth > 0 && { flex: undefined, flexGrow: 0, flexShrink: 0, flexBasis: 'auto', width: (embeddedWidth - 6) / 3, height: (embeddedWidth - 6) / 3 / 0.68 }]} accessibilityLabel={`Moment in ${item.place.name}`} onPress={() => router.push({ pathname: '/moment/[id]', params: { id: item.id, ownerId, placeId, saved: saved ? '1' : undefined } })}>
    <View style={[StyleSheet.absoluteFill, { backgroundColor: resolvePresentationColor(placeholder, 'backgroundColor', 'content') }]}><StableCachedImage key={item.id} cacheScope={cacheScope} uri={item.cover_url} namespace={`moment-grid:${item.id}`} onSourceError={() => onImageError?.(item)} onLoad={() => onImageLoad?.(item)} style={StyleSheet.absoluteFill} /></View>
    <Ionicons name="play" size={17} color={resolvePresentationColor("white", 'color', 'content')} style={styles.play} />
    <Text numberOfLines={1} style={presentationTextStyle(styles.location)}>{item.place.locality || item.place.name}</Text>
  </Pressable>;
});
const styles = StyleSheet.create({ embeddedGrid: { flexDirection: 'row', flexWrap: 'wrap' }, tile: { flex: 1/3, aspectRatio: 0.68, margin: 1, overflow: 'hidden' }, play: { position: 'absolute', top: 8, right: 8 }, location: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 9, color: 'white', backgroundColor: 'rgba(0,0,0,0.4)', fontSize: 12 }, empty: { padding: 40, alignItems: 'center' } });
const presentationBaselineStyles = styles;

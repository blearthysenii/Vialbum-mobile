import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { useAppColorScheme as useColorScheme } from '@/theme/appearance';
import { setJourneyThumbnailViewport } from '@/features/media/decodedThumbnailCache';
import { createUrlRenewalCoordinator, thumbnailRenewalKey } from '@/utils/urlRenewal';
import { requireRefreshSuccess, summarizeRefresh } from '@/utils/refreshOutcome';
import { MomentTile, ProfileMediaTabs } from '@/features/moments/MomentGrid';
import { CreateJourneySheet } from '@/features/journeys/components/CreateJourneySheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { setStatusBarStyle } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Modal, Pressable, RefreshControl, StyleSheet, Text, useWindowDimensions, View, type ViewProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import { useOwnFollowStats } from '@/features/follows/useOwnFollowStats';
import { GlassButton } from '@/features/stays/StayGlass';
import { cachedProfileAlbums, profileCollection } from '@/features/profile/dataCache';
import { profileRefreshTiming } from '@/features/profile/refreshTiming';
import { useProfilePull } from '@/features/profile/ProfileRefreshIndicator';
import { ProfileCover } from '@/features/profile/components/ProfileCover';

import { useAuth } from '@/features/auth/AuthProvider';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';
import { useTabBarController } from '@/features/navigation/TabBarScrollContext';
import { navigationBottom, NAVIGATION_HEIGHT } from '@/features/navigation/geometry';
import { JourneyThumbnail, journeyThumbnailSource, usePublishedProfileJourneys } from '@/features/profile/components/ProfileJourneyGrid';
import { useProfileMoments } from '@/features/moments/useProfileMoments';
import { momentsApi } from '@/features/moments/api';
import type { Moment } from '@/features/moments/types';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { shareProfile } from '@/features/profile/share';
import { useProfileTheme } from '@/features/profile/theme';
import type { ProfileJourney } from '@/features/profile/types';

// Shared bounds for the compact Profile stats and owner action rows.
const PROFILE_CONTENT_HORIZONTAL = 40;
type Cell = { kind: 'journey'; value: ProfileJourney } | { kind: 'moment'; value: Moment };
// Reanimated passes style arrays, while this FlashList version spreads style
// as an object. Normalize that documented boundary before the list sees it.
const ProfileList = forwardRef<FlashListRef<Cell>, FlashListProps<Cell>>(function ProfileList({ style, ...props }, ref) {
  return <FlashList ref={ref} {...props} style={StyleSheet.flatten(style)} />;
});
const ProfileGridList = Animated.createAnimatedComponent(ProfileList);
const PROFILE_SCROLL_ANCHOR = { autoscrollToTopThreshold: 0 };
// The recycler can memoize item content across index changes. Apply column
// spacing in its cell container, whose index/layout always follows the item.
const JourneyCell = forwardRef<View, ViewProps & { index: number }>(function JourneyCell({ index, style, ...props }, ref) {
  return <View ref={ref} {...props} style={[style, { transform: [{ translateX: (index % 3) * 2 / 3 }] }]} />;
});

function Photo({ source, label, color, backgroundColor, avatar = false, fallbackIconSize = 54, onSourceError }: {
  source: string | null; label: string; color: string; backgroundColor: string; avatar?: boolean; fallbackIconSize?: number; onSourceError?: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  if (avatar) {
    return <View style={[styles.photo, { backgroundColor }]}><ProfileAvatarImage source={source} label={label} cacheKey="profile-avatar" style={styles.photoImage} fallbackIconSize={fallbackIconSize} onSourceError={onSourceError} /></View>;
  }
  return <AlbumPhoto source={source} label={label} color={resolvePresentationColor(color, 'color', 'content')} backgroundColor={backgroundColor} />;
}

function AlbumPhoto({ source, label, color, backgroundColor }: {
  source: string | null; label: string; color: string; backgroundColor: string;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const uri = useMemo(() => resolveApiImageUrl(source, label), [label, source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(uri && failedUrl !== uri);
  useEffect(() => {
    setFailedUrl(null);
  }, [uri]);
  return (
    <View style={[styles.photo, { backgroundColor }]}>
      {!showImage ? <Ionicons name="albums-outline" size={38} color={resolvePresentationColor(color, 'color', 'content')} /> : null}
      {showImage ? (
        <Image
          source={cachedImageSource(uri!, label)}
          contentFit="cover"
          cachePolicy="disk"
          transition={240}
          style={styles.photoImage}
          onError={(response) => {
            setFailedUrl(uri);
            if (__DEV__) console.warn(`[Profile image] ${label} onError`, { url: uri, response });
          }}
        />
      ) : null}
    </View>
  );
}


export default function ProfileScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { user, refreshUser } = useAuth();
  const userId = user?.id;
  const social = useOwnFollowStats();
  const refreshSocial = social.refresh;
  const { journeys, isLoading: journeysLoading, error: journeyError, refresh, refreshOutcome: refreshJourneysOutcome, fetchOne, totalCount, loadingMore: journeysLoadingMore, loadMore: loadMoreJourneys } = useJourneys({ paginated: true });
  const theme = useProfileTheme();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pageProgress = useSharedValue(profileCollection.get(user?.id) === 'moments' ? 1 : 0);
  const heroHeight = insets.top + Math.min(286, Math.max(242, width * .67));
  const heroAtTop = useRef(true);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setStatusBarStyle(heroAtTop.current || dark ? 'light' : 'dark');
    return () => { focused.current = false; setStatusBarStyle(dark ? 'light' : 'dark'); };
  }, [dark]));
  const { setCollapsed } = useTabBarController();
  const onScrollState = useCallback((collapsed: boolean, overPhoto: boolean) => {
    if (!focused.current) return;
    setCollapsed(collapsed);
    if (overPhoto !== heroAtTop.current) {
      heroAtTop.current = overPhoto;
      setStatusBarStyle(overPhoto || dark ? 'light' : 'dark');
    }
  }, [dark, setCollapsed]);
  const albums = useMemo(() => cachedProfileAlbums(user?.id, journeys), [user?.id, journeys]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [collectionState, updateCollection] = useState(() => ({ owner: userId, value: profileCollection.get(userId) }));
  const collection = collectionState.owner === userId ? collectionState.value : profileCollection.get(userId);
  const activeCollection = useRef(collection); activeCollection.current = collection;
  const releaseAction = useRef<(() => void) | null>(null);
  const onReleaseRefresh = useCallback(() => releaseAction.current?.(), []);
  const pullInteraction = useProfilePull({ resetKey: userId, refreshing, topInset: insets.top, heroHeight, theme, onScrollState, onReleaseRefresh });
  const syncScrollState = pullInteraction.syncScrollState;
  useFocusEffect(useCallback(() => { syncScrollState(); }, [syncScrollState]));

  const refreshInFlight = useRef(false);
  const openingJourneyRef = useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    openingJourneyRef.current = null;
  }, []));

  useEffect(() => {
    if (!__DEV__) return;
    console.debug('[Profile images] API response fields', {
      has_profile_photo: Boolean(user?.profile_photo_url),
      has_profile_cover: Boolean(user?.profile_cover_url),
    });
  }, [user?.profile_cover_url, user?.profile_photo_url]);
  const { store: momentStore, state: momentState } = useProfileMoments(userId, collection === 'moments');
  const [draftCounts, setDraftCounts] = useState({ owner: userId, count: 0 });
  const reportDraftCount = useCallback((count: number) => setDraftCounts(previous => previous.owner === userId && previous.count === count ? previous : { owner: userId, count }), [userId]);
  const publishedJourneys = usePublishedProfileJourneys(userId, albums, reportDraftCount);
  const setCollection = useCallback((value: 'journeys' | 'moments') => {
    if (__DEV__) console.debug('[Profile lifecycle] collection', value);
    if (userId) profileCollection.set(userId, value);
    updateCollection({ owner: userId, value });
  }, [userId]);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const openCreate = useCallback(() => {
    setShowCreate(true);
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const next = collection === 'moments' ? 1 : 0;
    pageProgress.set(reduceMotion ? next : withTiming(next, { duration: 200 }));
  }, [collection, pageProgress, reduceMotion]);
  const surface = theme.dark ? '#262628' : '#EFEFEF';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const selectionHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    setShowAvatar(false); setShowCreate(false); setShareError(null); setDetailError(null);
  }, [userId]);

  const pullToRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setRefreshing(true);
    const trace = profileRefreshTiming();
    trace.mark('refresh start');
    trace.mark('moments', collection === 'moments' ? 'selected grid refresh runs concurrently' : 'skipped: not visible');
    trace.mark('memories', 'skipped: not used by Profile cards');
    trace.mark('image prefetch/cache invalidation', 'none; existing disk cache retained');
    try {
      const results = await Promise.allSettled([
        trace.run('journeys', async () => {
          if (refreshJourneysOutcome) requireRefreshSuccess(await refreshJourneysOutcome());
          else if (!await refresh()) throw new Error('Journeys refresh failed');
        }),
        trace.run('profile', refreshUser),
        trace.run('stats', refreshSocial).then(requireRefreshSuccess),
        ...(collection === 'moments' ? [trace.run('moments', () => momentStore.refreshOutcome(true)).then(requireRefreshSuccess)] : []),
      ]);
      const outcome = summarizeRefresh(results);
      trace.mark('outcome', outcome);
      if (outcome !== 'success' && outcome !== 'cancelled') {
        setDetailError(outcome === 'partial' ? 'Some profile information could not be refreshed. Please try again.' : outcome === 'authorization' ? 'Please sign in again to refresh your profile.' : 'Your profile could not be refreshed. Please try again.');
      } else setDetailError(null);
    } finally {
      refreshInFlight.current = false;
      setRefreshing(false);
      trace.mark('indicator exit requested');
      trace.finish();
    }
  }, [refresh, refreshJourneysOutcome, refreshUser, refreshSocial, collection, momentStore]);

  releaseAction.current = () => { void pullToRefresh(); };
  const openJourney = useCallback((item: ProfileJourney) => {
    if (openingJourneyRef.current) return;
    openingJourneyRef.current = item.id;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    router.push({ pathname: '/post/[id]', params: { id: item.id, scope: 'own' } });
  }, []);
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.username || '';
  const profileCoverSource = user?.profile_cover_url ?? null;
  const journeyCells = useMemo<Cell[]>(() => publishedJourneys.map(value => ({ kind: 'journey', value })), [publishedJourneys]);
  const momentCells = useMemo<Cell[]>(() => momentState.items.map(value => ({ kind: 'moment', value })), [momentState.items]);
  const renewals = useMemo(() => createUrlRenewalCoordinator(undefined, userId), [userId]);
  useEffect(() => () => renewals.clear(), [renewals]);
  const refreshJourneyImage = useCallback((item: ProfileJourney) => {
    void renewals.run(thumbnailRenewalKey('journey', item.id, item.cover_media_url), () => fetchOne(item.id)).catch(() => {
      if (__DEV__) console.warn('[Profile thumbnail] Journey URL renewal failed', { id: item.id });
    });
  }, [fetchOne, renewals]);
  const refreshMomentImage = useCallback((item: Moment) => {
    void renewals.run(thumbnailRenewalKey('moment', item.id, item.cover_url), () => momentStore.refreshItem(item.id, () => momentsApi.get(item.id))).catch(() => {
      if (__DEV__) console.warn('[Profile thumbnail] Moment URL renewal failed', { id: item.id });
    });
  }, [momentStore, renewals]);
  const journeyImageDisplayed = useCallback((item: ProfileJourney) => renewals.reset(thumbnailRenewalKey('journey', item.id, item.cover_media_url)), [renewals]);
  const momentImageDisplayed = useCallback((item: Moment) => renewals.reset(thumbnailRenewalKey('moment', item.id, item.cover_url)), [renewals]);
  const refreshCoverImage = useCallback(() => { void renewals.run('identity-media', refreshUser).catch(() => { if (__DEV__) console.warn('[Profile image] identity renewal failed'); }); }, [refreshUser, renewals]);
  const renderCell = useCallback(({ item }: { item: Cell }) => item.kind === 'journey'
    // FlashList places individual cells in equal-width columns. Preserve the
    // approved square sizes and two-point gaps inside those measured columns.
    ? <View style={{ width: (width - 4) / 3, height: (width - 4) / 3 + 2 }}>
        <JourneyThumbnail cacheScope={userId} journey={item.value} size={(width - 4) / 3} placeholder={theme.placeholder} onOpen={openJourney} onImageError={refreshJourneyImage} onImageLoad={journeyImageDisplayed} onImageRetry={journeyImageDisplayed} />
      </View>
    : <MomentTile cacheScope={userId} item={item.value} ownerId={userId} placeholder={theme.placeholder} embeddedWidth={width} onImageError={refreshMomentImage} onImageLoad={momentImageDisplayed} />,
    [width, theme.placeholder, openJourney, userId, refreshJourneyImage, refreshMomentImage, journeyImageDisplayed, momentImageDisplayed]);
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Cell; isViewable: boolean }[] }) => {
    if (!userId || activeCollection.current !== 'journeys') return;
    const visible = viewableItems.flatMap(({ item, isViewable }) => {
      if (!isViewable || item.kind !== 'journey') return [];
      const uri = journeyThumbnailSource(item.value);
      return uri ? [{ namespace: `journey.album.cover:${item.value.id}`, uri }] : [];
    });
    if (visible.length) setJourneyThumbnailViewport(userId, visible);
  }, [userId]);
  useEffect(() => { if (userId && !journeyCells.length) setJourneyThumbnailViewport(userId, []); }, [userId, journeyCells]);
  const keyCell = useCallback((item: Cell) => `${item.kind}:${item.value.id}`, []);
  const cellType = useCallback((item: Cell) => item.kind, []);
  const loadMore = useCallback(() => {
    if (activeCollection.current === 'moments') void momentStore.loadMore();
    else void loadMoreJourneys?.();
  }, [momentStore, loadMoreJourneys]);


  const header = useMemo(() => user ? (
    <View>
      <View style={[styles.profileHero, { height: heroHeight }]}>
        <Text pointerEvents="none" style={presentationTextStyle([styles.heroMotto, { top: insets.top + 80 }])}>Explore{`\n`}Capture{`\n`}Remember</Text>
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <View style={{ position: 'absolute', left: 20 }}><GlassButton label="Create a journey" theme={theme} media radius={24} onPress={openCreate} style={styles.heroControl}><Ionicons name="add" size={27} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></GlassButton></View>
          <View style={styles.settingsButton}><GlassButton label="Open settings" theme={theme} media radius={24} onPress={() => router.push('/settings')} style={styles.heroControl}><Ionicons name="settings-outline" size={23} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></GlassButton></View>
        </View>
      </View>

      <View style={[styles.identity, { marginTop: -82 }]}>
        <Animated.View>
          <Pressable accessibilityRole="button" accessibilityLabel="View profile photo" onPress={() => setShowAvatar(true)}
            style={({ pressed }) => [styles.avatar, { borderColor: resolvePresentationColor(theme.canvas, 'borderColor', 'control') }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url" color={resolvePresentationColor("#FFFFFF", 'color', 'content')} backgroundColor={dark ? '#52677F' : '#90A6C0'} avatar onSourceError={refreshCoverImage} />
          </Pressable>
        </Animated.View>
        <Animated.View style={styles.identityCopy}>
          <Text style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{name}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={presentationTextStyle([styles.profileUsername, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>@{user.username}</Text>
        </Animated.View>

      </View>

      <Animated.View style={styles.stats}>
        {[
          { value: Math.max(0, (totalCount ?? journeys.length) - (draftCounts.owner === userId ? draftCounts.count : journeys.length - publishedJourneys.length)), loading: journeysLoading && journeys.length === 0, label: 'Journeys' },
          { value: social.stats?.followers_count ?? '—', loading: social.loading && !social.stats, label: 'Followers', kind: 'followers' },
          { value: social.stats?.following_count ?? '—', loading: social.loading && !social.stats, label: 'Following', kind: 'following' },
        ].map((stat, index) => (
          <View key={stat.label} style={[styles.statSlot, index === 1 && styles.statCenterSlot, index === 2 && styles.statRightSlot]}>
          <Pressable style={({ pressed }) => [styles.stat, pressed && styles.pressedOpacity]} accessibilityRole="button" accessibilityLabel={`${stat.label}, ${stat.loading ? 'loading' : stat.value}`} onPress={() => {
            if (stat.kind) router.push({ pathname: '/public-profile/[id]/connections', params: { id: user.id, kind: stat.kind } });
            else setCollection('journeys');
          }}>
            {stat.loading ? <View style={[styles.statPlaceholder, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]} /> : <Animated.Text style={presentationTextStyle([styles.statValue, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{typeof stat.value === 'number' ? stat.value.toLocaleString('en-US', stat.value >= 1000 ? { notation: 'compact', maximumFractionDigits: 1 } : undefined) : stat.value}</Animated.Text>}
            <Text style={presentationTextStyle([styles.statLabel, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{stat.label}</Text>
          </Pressable>
          </View>
        ))}
      </Animated.View>
      <Animated.View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => { selectionHaptic(); router.push('/edit-profile'); }}
            style={({ pressed }) => [styles.editButton, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.10)', 'borderColor', 'control') }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={presentationTextStyle([styles.editLabel, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Edit Profile</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={() => {
            selectionHaptic();
            setShareError(null);
            void Promise.resolve().then(() => shareProfile(user.username)).catch(() => setShareError('Your profile could not be shared. Please try again.'));
          }} style={({ pressed }) => [styles.editButton, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.08)' : 'rgba(60,60,67,0.10)', 'borderColor', 'control') }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={presentationTextStyle([styles.editLabel, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Share Profile</Text>
          </Pressable>
        </Animated.View>
      {social.error ? <Pressable onPress={() => void refreshSocial()} accessibilityRole="button"><Text style={presentationTextStyle([styles.error, { color: resolvePresentationColor(theme.danger, 'color', 'content') }])}>{social.error}</Text></Pressable> : null}
      {journeyError || detailError || shareError ? <Text accessibilityRole="alert" style={presentationTextStyle([styles.error, { color: resolvePresentationColor(theme.danger, 'color', 'content') }])}>{journeyError || detailError || shareError}</Text> : null}

      <View style={{ marginTop: 28 }}>
      <ProfileMediaTabs initialWidth={width} progress={pageProgress} selected={collection} onChange={setCollection} contentMargin={32} bottomSpacing={0} />
      </View>

    </View>
  ) : null, [styles, user, dark, heroHeight, insets.top, theme, reduceMotion, name, totalCount, draftCounts, userId, publishedJourneys.length, journeysLoading, journeys.length, social.stats, social.loading, social.error, refreshSocial, surface, journeyError, detailError, shareError, collection, setCollection, width, pageProgress, openCreate, selectionHaptic, refreshCoverImage]);
  const listHeader = useMemo(() => <View>{header}</View>, [header]);
  const momentEmpty = <View style={{ padding: 40, alignItems: 'center' }}>{momentState.loading && !momentState.loaded && !momentState.items.length ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), textAlign: 'center' })}>{momentState.error || "Share a moment from somewhere you've been."}</Text>{momentState.error ? <Pressable onPress={() => void momentStore.refresh(true)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), marginTop: 15 })}>Retry</Text></Pressable> : null}</>}</View>;
  const journeyEmpty = journeysLoading ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={{ paddingVertical: 24 }} /> : <View style={{ padding: 40, alignItems: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), textAlign: 'center' })}>{journeyError || 'No journeys yet. Share your first journey.'}</Text>{journeyError ? <Pressable accessibilityRole="button" onPress={() => void refresh()}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), marginTop: 15 })}>Retry</Text></Pressable> : null}</View>;
  const momentFooter = momentState.loadingMore && momentState.items.length ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={{ margin: 25 }} /> : null;
  const contentStyle = useMemo(() => ({ paddingBottom: navigationBottom(insets.bottom) + NAVIGATION_HEIGHT }), [insets.bottom]);
  if (!user) return null;

  return (
    <SafeAreaView key={user.id} edges={[]} style={[styles.safe, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
      <Animated.View pointerEvents="none" style={[styles.heroBackground, { height: heroHeight }, pullInteraction.heroStyle]}>
        <ProfileCover source={profileCoverSource} canvas={theme.canvas} dark={dark} reduceMotion={reduceMotion} onSourceError={refreshCoverImage} />
      </Animated.View>
      <ProfileGridList key={user.id} data={collection === 'journeys' ? journeyCells : momentCells} numColumns={3}
        onViewableItemsChanged={onViewableItemsChanged} keyExtractor={keyCell} getItemType={cellType} renderItem={renderCell}
        ListHeaderComponent={listHeader} ListEmptyComponent={collection === 'journeys' ? journeyEmpty : momentEmpty}
        ListFooterComponent={collection === 'moments' ? momentFooter : journeysLoadingMore ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={{ margin: 25 }} /> : null}
        CellRendererComponent={collection === 'journeys' ? JourneyCell : undefined}
        style={styles.scroll} onScroll={pullInteraction.onScroll} scrollEventThrottle={16}
        maxItemsInRecyclePool={18} maintainVisibleContentPosition={PROFILE_SCROLL_ANCHOR}
        contentContainerStyle={contentStyle}
        contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false}
        alwaysBounceVertical showsVerticalScrollIndicator={false} onEndReached={loadMore} onEndReachedThreshold={.5}
        refreshControl={<RefreshControl progressViewOffset={insets.top + 8} refreshing={refreshing}
          onRefresh={() => pullInteraction.requestRefresh(() => releaseAction.current?.())}
          tintColor={resolvePresentationColor("transparent", 'tintColor', 'content')} colors={resolvePresentationColor(['transparent'], 'colors', 'content')} progressBackgroundColor="transparent" />} />
      {pullInteraction.indicator}
      <CreateJourneySheet visible={showCreate} draftCount={0} onClose={() => setShowCreate(false)} onChoose={target => router.push(target === 'moment' ? '/moment/new' : '/journey/new')} />
      <Modal visible={showAvatar} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowAvatar(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo" onPress={() => setShowAvatar(false)} style={styles.previewBackdrop}>
          <Pressable accessibilityRole="image" accessibilityLabel={`${name}'s profile photo`} onPress={(event) => event.stopPropagation()} style={styles.previewPhoto}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url:preview" color={resolvePresentationColor("#FFFFFF", 'color', 'content')} backgroundColor="transparent" avatar fallbackIconSize={190} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setShowAvatar(false)} style={({ pressed }) => [styles.previewClose, pressed && styles.pressed]}>
            <Ionicons name="close" size={23} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, overflow: 'hidden' },
  // Bound the viewport; only the header, rows and navigation clearance size content.
  scroll: { flex: 1, backgroundColor: 'transparent' },
  heroBackground: { position: 'absolute', top: 0, left: 0, right: 0 },
  profileHero: { overflow: 'visible' },
  cover: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  coverImage: { ...StyleSheet.absoluteFill },
  topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, height: 56, alignItems: 'center', justifyContent: 'center' },
  heroMotto: { position: 'absolute', left: 34, color: '#FFFFFF', fontFamily: 'System', fontSize: 15, lineHeight: 21, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.34)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 1 } },
  settingsButton: { position: 'absolute', right: 20 },
  heroControl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  pressedOpacity: { opacity: 0.65 },
  identity: { alignItems: 'center', paddingHorizontal: 32, marginTop: -82 },
  identityCopy: { alignItems: 'center', alignSelf: 'stretch' },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, overflow: 'hidden', marginBottom: 12, zIndex: 3, elevation: 3 },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  previewPhoto: { width: '100%', maxWidth: 390, aspectRatio: 1, borderRadius: 28, overflow: 'hidden' },
  previewClose: { position: 'absolute', top: 58, right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'System', fontSize: 28, lineHeight: 33, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  profileUsername: { maxWidth: '100%', fontFamily: 'System', fontSize: 16, lineHeight: 21, fontWeight: '500', letterSpacing: -0.2, textAlign: 'center', marginTop: 6 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginHorizontal: PROFILE_CONTENT_HORIZONTAL },
  editButton: { flex: 1, minWidth: 0, height: 36, minHeight: 36, borderRadius: 7, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 8, paddingVertical: 0, justifyContent: 'center', alignItems: 'center' },
  editLabel: { fontSize: 14, lineHeight: 18, fontWeight: '600' },
  stats: { flexDirection: 'row', marginHorizontal: PROFILE_CONTENT_HORIZONTAL, marginTop: 24, alignItems: 'flex-start' },
  statSlot: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  statCenterSlot: { alignItems: 'center' },
  statRightSlot: { alignItems: 'flex-end' },
  stat: { alignItems: 'flex-start', minHeight: 46, justifyContent: 'center' },
  statValue: { textAlign: 'left', fontSize: 15, lineHeight: 18, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statPlaceholder: { width: 18, height: 5, borderRadius: 3, marginVertical: 11 },
  statLabel: { textAlign: 'left', fontSize: 13.5, lineHeight: 17, fontWeight: '400', marginTop: 4 },
  error: { marginHorizontal: 20, marginTop: 14, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  textButton: { minHeight: 44, justifyContent: 'center' },
});
const presentationBaselineStyles = styles;

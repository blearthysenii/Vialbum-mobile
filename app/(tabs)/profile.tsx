import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { useOwnFollowStats } from '@/features/follows/useOwnFollowStats';
import { ProfileCover } from '@/features/profile/components/ProfileCover';

import { useAuth } from '@/features/auth/AuthProvider';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';
import { mediaApi } from '@/features/media/api';
import { memoryApi } from '@/features/memories/api';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { albumDates, JourneyAlbumCard, ProfileEmptyState } from '@/features/profile/components/TravelProfileContent';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { shareProfile } from '@/features/profile/share';
import { useProfileTheme } from '@/features/profile/theme';
import { authDarkColors, authLightColors } from '@/features/auth/theme';
import type { ProfileJourney } from '@/features/profile/types';

const coverEntrance = () => {
  'worklet';
  const timing = { duration: 420, easing: Easing.out(Easing.cubic) };
  return {
    initialValues: { opacity: 0, transform: [{ scale: 1.018 }] },
    animations: { opacity: withTiming(1, timing), transform: [{ scale: withTiming(1, timing) }] },
  };
};

const avatarEntrance = () => {
  'worklet';
  const spring = { damping: 24, stiffness: 220, mass: 0.75 };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.96 }] },
    animations: {
      opacity: withDelay(60, withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })),
      transform: [
        { translateY: withDelay(60, withSpring(0, spring)) },
        { scale: withDelay(60, withSpring(1, spring)) },
      ],
    },
  };
};

const actionsEntrance = () => {
  'worklet';
  const timing = { duration: 250, easing: Easing.out(Easing.cubic) };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: 5 }, { scale: 0.98 }] },
    animations: {
      opacity: withDelay(160, withTiming(1, timing)),
      transform: [
        { translateY: withDelay(160, withTiming(0, timing)) },
        { scale: withDelay(160, withTiming(1, timing)) },
      ],
    },
  };
};

function Photo({ source, label, color, backgroundColor, avatar = false, fallbackIconSize = 54 }: {
  source: string | null; label: string; color: string; backgroundColor: string; avatar?: boolean; fallbackIconSize?: number;
}) {
  if (avatar) {
    return <View style={[styles.photo, { backgroundColor }]}><ProfileAvatarImage source={source} label={label} cacheKey="profile-avatar" style={styles.photoImage} fallbackIconSize={fallbackIconSize} /></View>;
  }
  return <AlbumPhoto source={source} label={label} color={color} backgroundColor={backgroundColor} />;
}

function AlbumPhoto({ source, label, color, backgroundColor }: {
  source: string | null; label: string; color: string; backgroundColor: string;
}) {
  const uri = useMemo(() => resolveApiImageUrl(source, label), [label, source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(uri && failedUrl !== uri);
  useEffect(() => {
    setFailedUrl(null);
  }, [uri]);
  return (
    <View style={[styles.photo, { backgroundColor }]}>
      {!showImage ? <Ionicons name="albums-outline" size={38} color={color} /> : null}
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
  const { user, refreshUser } = useAuth();
  const social = useOwnFollowStats();
  const refreshSocial = social.refresh;
  const { journeys, isLoading: journeysLoading, error: journeyError, refresh } = useJourneys();
  const theme = useProfileTheme();
  const profileBorder = (theme.dark ? authDarkColors : authLightColors).glassBorder;
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const tabBarScroll = useTabBarScroll();
  const [albums, setAlbums] = useState<ProfileJourney[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const albumRequest = useRef<{ journeys: typeof journeys; promise: Promise<void> } | null>(null);
  const albumRequestVersion = useRef(0);
  const openingJourneyRef = useRef<string | null>(null);

  useFocusEffect(useCallback(() => {
    openingJourneyRef.current = null;
  }, []));

  useEffect(() => {
    if (!__DEV__) return;
    console.debug('[Profile images] API response fields', {
      profile_photo_url: user?.profile_photo_url ?? null,
      first_journey_cover_media_url: journeys[0]?.cover_media_url ?? null,
    });
  }, [journeys, user?.profile_photo_url]);
  const [showAll, setShowAll] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const dividerReduceMotionAtMount = useReducedMotion();
  const dividerReduceMotion = reduceMotion || dividerReduceMotionAtMount;
  const dividerReveal = useSharedValue(dividerReduceMotion ? 1 : 0);
  const dividerAnimatedStyle = useAnimatedStyle(() => {
    const progress = dividerReduceMotion ? 1 : dividerReveal.value;
    return {
      opacity: progress,
      transform: [{ scaleX: 0.92 + 0.08 * progress }, { translateY: 2 * (1 - progress) }],
    };
  });

  const refreshHoldHeight = useSharedValue(0);
  const refreshHoldAnimatedStyle = useAnimatedStyle(() => ({
    height: refreshHoldHeight.value,
    opacity: refreshHoldHeight.value / 56,
  }));

  useFocusEffect(useCallback(() => {
    cancelAnimation(dividerReveal);
    if (dividerReduceMotion) {
      dividerReveal.set(1);
    } else {
      dividerReveal.set(0);
      dividerReveal.set(withDelay(120, withTiming(1, {
        duration: 450,
        easing: Easing.out(Easing.cubic),
      })));
    }
    return () => cancelAnimation(dividerReveal);
  }, [dividerReduceMotion, dividerReveal]));

  const surface = dark ? '#191C20' : '#F5F7F9';
  const border = dark ? '#30353A' : '#E8EBEF';
  const statDivider = dark ? 'rgba(84, 84, 88, 0.55)' : 'rgba(60, 60, 67, 0.18)';
  const accent = '#0A84FF';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    cancelAnimation(refreshHoldHeight);

    if (refreshing) {
      refreshHoldHeight.set(
        reduceMotion
          ? 56
          : withTiming(56, {
              duration: 180,
              easing: Easing.out(Easing.cubic),
            }),
      );
      return;
    }

    refreshHoldHeight.set(
      reduceMotion
        ? 0
        : withTiming(0, {
            duration: 260,
            easing: Easing.out(Easing.cubic),
          }),
    );
  }, [reduceMotion, refreshing, refreshHoldHeight]);

  const selectionHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  const loadAlbums = useCallback((nextJourneys: typeof journeys) => {
    if (albumRequest.current?.journeys === nextJourneys) return albumRequest.current.promise;
    const version = ++albumRequestVersion.current;
    setDetailError(null);
    // Keep cached album content visible while refreshed details arrive.
    setAlbums((current) => nextJourneys.map((journey) => {
      const existing = current.find((album) => album.id === journey.id);
      return { ...journey, memories: existing?.memories ?? [], media: existing?.media ?? [] };
    }));
    setLoadingDetails(nextJourneys.length > 0);
    const promise = Promise.all(nextJourneys.map(async (journey) => {
      const [memoriesResult, mediaResult] = await Promise.allSettled([
        memoryApi.list(journey.id),
        mediaApi.list(journey.id),
      ]);
      return {
        album: {
          ...journey,
          memories: memoriesResult.status === 'fulfilled' ? memoriesResult.value : [],
          media: mediaResult.status === 'fulfilled' ? mediaResult.value : [],
        },
        failed: memoriesResult.status === 'rejected' || mediaResult.status === 'rejected',
      };
    })).then((results) => {
      if (version !== albumRequestVersion.current) return;
      setAlbums((current) => results.map((result) => {
        const cached = current.find((album) => album.id === result.album.id);
        return result.failed && cached
          ? { ...result.album, memories: cached.memories, media: cached.media }
          : result.album;
      }));
      if (results.some((result) => result.failed)) setDetailError('Some memories could not be loaded. Pull down to try again.');
    }).finally(() => { if (version === albumRequestVersion.current) setLoadingDetails(false); });
    albumRequest.current = { journeys: nextJourneys, promise };
    return promise;
  }, []);

  useEffect(() => {
    void loadAlbums(journeys);
  }, [journeys, loadAlbums]);

  useEffect(() => () => { albumRequestVersion.current += 1; albumRequest.current = null; }, []);

  const pullToRefresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    const refreshStartedAt = Date.now();
    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        refresh().then(async (refreshedJourneys) => {
          if (refreshedJourneys) await loadAlbums(refreshedJourneys);
          else if (albumRequest.current) await albumRequest.current.promise;
        }),
        refreshUser(),
        refreshSocial(),
      ]);
      if (results.some((result) => result.status === 'rejected')) {
        setDetailError('Your profile could not be refreshed. Please try again.');
      }
    } finally {
      const remaining = 600 - (Date.now() - refreshStartedAt);
      if (remaining > 0) await new Promise<void>((resolve) => setTimeout(resolve, remaining));
      refreshInFlight.current = false;
      setRefreshing(false);
    }
  }, [loadAlbums, refresh, refreshUser, refreshSocial]);

  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const bio = user.bio?.trim() ?? '';
  const location = user.location?.trim() ?? '';
  const busy = journeysLoading || loadingDetails;
  const visibleAlbums = showAll ? albums : albums.slice(0, 2);
  const firstAlbumPhoto = albums[0]?.media.find((item) => item.type === 'photo');
  const profileCoverSource = user.profile_cover_url ?? journeys[0]?.cover_media_url ?? firstAlbumPhoto?.thumbnail_url ?? firstAlbumPhoto?.url ?? null;

  const header = (
    <View>
      <View style={styles.profileHero}>
        <Animated.View
          entering={reduceMotion
            ? FadeIn.duration(120)
            : coverEntrance}
          style={styles.coverEntrance}
        >
          <ProfileCover source={profileCoverSource} canvas={theme.canvas} dark={dark} reduceMotion={reduceMotion} />
        </Animated.View>
        <Text pointerEvents="none" style={[styles.heroMotto, { top: insets.top + 68 }]}>Explore{`\n`}Capture{`\n`}Remember</Text>
        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          <View />
          <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')}
            style={({ pressed }) => [styles.circleButton, styles.settingsButton, styles.coverSettings, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <BlurView pointerEvents="none" intensity={34} tint="dark" style={StyleSheet.absoluteFill} />
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <View style={styles.identity}>
        <Animated.View entering={reduceMotion ? FadeIn.duration(120) : avatarEntrance}>
          <Pressable accessibilityRole="button" accessibilityLabel="View profile photo" onPress={() => setShowAvatar(true)}
            style={({ pressed }) => [styles.avatar, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url" color="#FFFFFF" backgroundColor={dark ? '#52677F' : '#90A6C0'} avatar />
          </Pressable>
        </Animated.View>
        <Animated.View style={styles.identityCopy} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(110).duration(260).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 0, transform: [{ translateY: 5 }] })}>
          <Text style={[styles.name, { color: theme.ink }]}>{name}</Text>
          <Text numberOfLines={1} style={[styles.profileUsername, { color: theme.muted }]}>@{user.username}</Text>
          {bio ? <Text numberOfLines={3} style={[styles.bio, { color: theme.ink }]}>{bio}</Text> : null}
          {location ? <Text style={[styles.location, { color: theme.muted }]}><Ionicons name="location-outline" size={14} /> {location}</Text> : null}
        </Animated.View>
        <Animated.View style={styles.actions} entering={reduceMotion ? FadeIn.duration(120) : actionsEntrance}>
          <Pressable accessibilityRole="button" onPress={() => { selectionHaptic(); router.push('/edit-profile'); }}
            style={({ pressed }) => [styles.editButton, { backgroundColor: surface, borderColor: border }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Text style={[styles.editLabel, { color: theme.ink }]}>Edit Profile</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share profile" onPress={() => {
            selectionHaptic();
            setShareError(null);
            void Promise.resolve().then(() => shareProfile(user.username)).catch(() => setShareError('Your profile could not be shared. Please try again.'));
          }} style={({ pressed }) => [styles.circleButton, { backgroundColor: surface, borderColor: border }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Ionicons name="share-outline" size={23} color={theme.ink} />
          </Pressable>
        </Animated.View>
      </View>

      <Animated.View style={styles.stats} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(210).duration(285).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 0, transform: [{ translateY: 5 }] })}>
        <View pointerEvents="none" style={[styles.statDivider, styles.firstStatDivider, { backgroundColor: statDivider }]} />
        <View pointerEvents="none" style={[styles.statDivider, styles.secondStatDivider, { backgroundColor: statDivider }]} />
        {[
          { value: journeys.length, loading: journeysLoading && journeys.length === 0, label: journeys.length === 1 ? 'Journey' : 'Journeys' },
          { value: social.stats?.followers_count ?? '—', loading: social.loading, label: 'Followers', kind: 'followers' },
          { value: social.stats?.following_count ?? '—', loading: social.loading, label: 'Following', kind: 'following' },
        ].map((stat) => (
          <Pressable key={stat.label} style={styles.stat} disabled={!stat.kind} accessibilityRole={stat.kind ? 'button' : undefined} onPress={() => router.push({ pathname: '/public-profile/[id]/connections', params: { id: user.id, kind: stat.kind } })}>
            {stat.loading ? <View style={[styles.statPlaceholder, { backgroundColor: theme.placeholder }]} /> : <Animated.Text entering={FadeIn.duration(reduceMotion ? 120 : 180)} style={[styles.statValue, { color: theme.ink }]}>{stat.value}</Animated.Text>}
            <Text style={[styles.statLabel, { color: theme.muted }]}>{stat.label}</Text>
          </Pressable>
        ))}
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.contentDivider, { backgroundColor: profileBorder, transformOrigin: 'center' }, dividerAnimatedStyle]} />
      {social.error ? <Pressable onPress={() => void refreshSocial()} accessibilityRole="button"><Text style={[styles.error, { color: theme.danger }]}>{social.error}</Text></Pressable> : null}
      {journeyError || detailError || shareError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{journeyError || detailError || shareError}</Text> : null}

      <Animated.View style={styles.sectionRow} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(260).duration(280).easing(Easing.out(Easing.cubic)).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open Saved Journeys" hitSlop={8} onPress={() => router.push('/saved-journeys')} style={styles.textButton}>
          <Text style={[styles.link, { color: theme.ink }]}><Ionicons name="bookmark-outline" size={17} /> Saved</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={styles.sectionRow}>
        <Text style={[styles.sectionHeading, { color: theme.ink }]}>Your albums</Text>
        {albums.length > 2 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} hitSlop={8}
          onPress={() => { selectionHaptic(); setShowAll((value) => !value); }} style={({ pressed }) => [styles.textButton, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
          <Text style={[styles.link, { color: accent }]}>{showAll ? 'Show less' : 'See all'}</Text>
        </Pressable> : null}
      </Animated.View>
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <FlatList
        {...tabBarScroll}
        data={visibleAlbums}
        numColumns={2}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <Animated.View
              pointerEvents="none"
              style={[styles.refreshHold, refreshHoldAnimatedStyle]}
            />
            {header}
          </View>
        }
        columnWrapperStyle={styles.albumRow}
        ListEmptyComponent={!busy && !journeyError && !detailError ? <ProfileEmptyState borderColor={profileBorder} icon="albums-outline" title="Your journeys will appear here." action="Create your first journey" onAction={() => router.push('/journey/new')} theme={theme} /> : null}
        renderItem={({ item }) => (
          <JourneyAlbumCard
            journey={item}
            theme={theme}
            date={albumDates(item)}
            loading={loadingDetails}
            reduceMotion={reduceMotion}
            index={visibleAlbums.findIndex((album) => album.id === item.id)}
            onPress={() => {
              if (openingJourneyRef.current) return;
              openingJourneyRef.current = item.id;
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              router.push({ pathname: '/post/[id]', params: { id: item.id, scope: 'own' } });
            }}
          />
        )}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl
            progressViewOffset={insets.top + 8}
            refreshing={refreshing}
            onRefresh={() => void pullToRefresh()}
            tintColor={theme.muted}
            colors={[theme.muted]}
            progressBackgroundColor={theme.canvas}
          />
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={showAvatar} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowAvatar(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo" onPress={() => setShowAvatar(false)} style={styles.previewBackdrop}>
          <Pressable accessibilityRole="image" accessibilityLabel={`${name}'s profile photo`} onPress={(event) => event.stopPropagation()} style={styles.previewPhoto}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url:preview" color="#FFFFFF" backgroundColor="transparent" avatar fallbackIconSize={190} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={() => setShowAvatar(false)} style={({ pressed }) => [styles.previewClose, pressed && styles.pressed]}>
            <Ionicons name="close" size={23} color="#FFFFFF" />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 150 },
  refreshHold: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  profileHero: { height: 260 },
  coverEntrance: { ...StyleSheet.absoluteFill },
  cover: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  coverImage: { ...StyleSheet.absoluteFill },
  coverCurve: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  topBar: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, height: 56, alignItems: 'center', justifyContent: 'center' },
  heroMotto: { position: 'absolute', left: 34, color: '#FFFFFF', fontFamily: 'System', fontSize: 15, lineHeight: 21, fontWeight: '500', textShadowColor: 'rgba(0,0,0,0.34)', textShadowRadius: 7, textShadowOffset: { width: 0, height: 1 } },
  circleButton: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  settingsButton: { position: 'absolute', right: 20 },
  coverSettings: { overflow: 'hidden', backgroundColor: 'rgba(32,32,34,0.28)', borderColor: 'rgba(255,255,255,0.32)' },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  pressedOpacity: { opacity: 0.65 },
  identity: { alignItems: 'center', paddingHorizontal: 28, marginTop: -108 },
  identityCopy: { alignItems: 'center' },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: 3, borderColor: '#FFFFFF', overflow: 'hidden', marginBottom: 12, zIndex: 3, elevation: 3 },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  previewPhoto: { width: '100%', maxWidth: 390, aspectRatio: 1, borderRadius: 28, overflow: 'hidden' },
  previewClose: { position: 'absolute', top: 58, right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: 'System', fontSize: 28, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  profileUsername: { maxWidth: '80%', fontFamily: 'System', fontSize: 15, lineHeight: 20, fontWeight: '500', letterSpacing: -0.2, textAlign: 'center', marginTop: 4 },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  location: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 17 },
  editButton: { minHeight: 48, minWidth: 160, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center' },
  editLabel: { fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', marginHorizontal: 27, marginTop: 23, marginBottom: 10, alignItems: 'center' },
  statDivider: { position: 'absolute', top: '50%', width: 1, height: 44, marginTop: -22 },
  firstStatDivider: { left: '33.333%' },
  secondStatDivider: { left: '66.666%' },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  statValue: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statPlaceholder: { width: 18, height: 5, borderRadius: 3, marginVertical: 11 },
  statLabel: { fontSize: 13, marginTop: 4 },
  contentDivider: { height: 1, marginHorizontal: 20, marginTop: 8 },
  error: { marginHorizontal: 20, marginTop: 14, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  sectionRow: { marginHorizontal: 20, marginTop: 28, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeading: { fontSize: 23, fontWeight: '700', letterSpacing: -0.6 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
  albumRow: { paddingHorizontal: 20, gap: 16 },
});

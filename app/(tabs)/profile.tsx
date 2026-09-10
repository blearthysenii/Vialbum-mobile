import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { useAuth } from '@/features/auth/AuthProvider';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { resolveApiImageUrl } from '@/features/media/imageUrl';
import { mediaApi } from '@/features/media/api';
import { memoryApi } from '@/features/memories/api';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { JourneyAlbumCard, ProfileEmptyState, TravelStatsCard } from '@/features/profile/components/TravelProfileContent';
import { shareProfile } from '@/features/profile/share';
import { useProfileTheme } from '@/features/profile/theme';
import type { ProfileJourney } from '@/features/profile/types';

function uniquePlaceCount(groups: ProfileJourney[]) {
  const keys = new Set<string>();
  for (const journey of groups) {
    if (journey.place) keys.add(journey.place.id ?? journey.place.display_name.trim().toLowerCase());
    for (const memory of journey.memories) {
      if (memory.place) keys.add(memory.place.id ?? memory.place.display_name.trim().toLowerCase());
    }
  }
  return keys.size;
}

function albumDates(journey: ProfileJourney): string {
  const format = (value: string) => {
    if (!value) return '';
    const date = new Date(value.slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const start = format(journey.start_date);
  const end = format(journey.end_date);
  return start && end && start !== end ? `${start} – ${end}` : start || end;
}

function Photo({ source, label, initials, color, backgroundColor, avatar = false, dark = false }: {
  source: string | null; label: string; initials?: string; color: string; backgroundColor: string; avatar?: boolean; dark?: boolean;
}) {
  const uri = useMemo(() => resolveApiImageUrl(source, label), [label, source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(uri));
  const showImage = Boolean(uri && failedUrl !== uri);
  useEffect(() => {
    setFailedUrl(null);
    setLoading(Boolean(uri));
  }, [uri]);
  return (
    <View style={[styles.photo, { backgroundColor }]}>
      {avatar && !showImage ? (
        <><LinearGradient colors={dark ? ['#52677F', '#303C4B'] : ['#A9BDD3', '#718AA5']} style={StyleSheet.absoluteFill} /><Text style={[styles.initials, { color }]}>{initials || '?'}</Text></>
      ) : !avatar && !showImage ? <Ionicons name="albums-outline" size={38} color={color} /> : null}
      {showImage ? (
        <Image
          source={uri}
          contentFit="cover"
          cachePolicy={avatar ? 'none' : 'disk'}
          transition={240}
          style={styles.photoImage}
          onLoadStart={() => setLoading(true)}
          onLoad={() => setLoading(false)}
          onError={(response) => {
            setLoading(false);
            setFailedUrl(uri);
            if (__DEV__) console.warn(`[Profile image] ${label} onError`, { url: uri, response });
          }}
        />
      ) : null}
      {loading && showImage ? <View style={[styles.photoLoading, { backgroundColor }]}><ActivityIndicator color={color} /></View> : null}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { journeys, isLoading: journeysLoading, error: journeyError, refresh } = useJourneys();
  const theme = useProfileTheme();
  const dark = useColorScheme() === 'dark';
  const tabBarScroll = useTabBarScroll();
  const [albums, setAlbums] = useState<ProfileJourney[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshProfileRef = useRef({ refresh, refreshUser });
  const openingJourneyRef = useRef<string | null>(null);
  refreshProfileRef.current = { refresh, refreshUser };

  useFocusEffect(useCallback(() => {
    openingJourneyRef.current = null;
    void Promise.all([refreshProfileRef.current.refreshUser(), refreshProfileRef.current.refresh()]);
  }, []));

  useEffect(() => {
    if (!__DEV__) return;
    console.debug('[Profile images] API response fields', {
      profile_photo_url: user?.profile_photo_url ?? null,
      first_journey_cover_media_url: journeys[0]?.cover_media_url ?? null,
    });
  }, [journeys, user?.profile_photo_url]);
  const [reload, setReload] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showAvatar, setShowAvatar] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const surface = dark ? '#191C20' : '#F5F7F9';
  const border = dark ? '#30353A' : '#E8EBEF';
  const statDivider = dark ? 'rgba(84, 84, 88, 0.55)' : 'rgba(60, 60, 67, 0.18)';
  const accent = '#0A84FF';

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const selectionHaptic = useCallback(() => {
    void Haptics.selectionAsync().catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    setDetailError(null);
    // Covers stay visible even if a memory request fails.
    setAlbums((current) => journeys.map((journey) => {
      const existing = current.find((album) => album.id === journey.id);
      return { ...journey, memories: existing?.memories ?? [], media: existing?.media ?? [] };
    }));
    if (!journeys.length) { setLoadingDetails(false); return; }
    setLoadingDetails(true);
    void Promise.all(journeys.map(async (journey) => {
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
      if (!active) return;
      setAlbums(results.map((result) => result.album));
      if (results.some((result) => result.failed)) setDetailError('Some memories could not be loaded. Pull down to try again.');
    }).finally(() => { if (active) setLoadingDetails(false); });
    return () => { active = false; };
  }, [journeys, reload]);

  const countries = useMemo(() => new Set(journeys.map((journey) => journey.country.trim().toLowerCase()).filter(Boolean)).size, [journeys]);
  const memories = useMemo(() => albums.reduce((sum, journey) => sum + journey.memories.length, 0), [albums]);
  const places = useMemo(() => uniquePlaceCount(albums), [albums]);
  const pullToRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.all([refresh(), refreshUser()]); setReload((value) => value + 1); }
    catch { setDetailError('Your profile could not be refreshed. Please try again.'); }
    finally { setRefreshing(false); }
  }, [refresh, refreshUser]);

  if (!user) return null;
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const bio = user.bio?.trim() ?? '';
  const location = user.location?.trim() ?? '';
  const busy = journeysLoading || loadingDetails;
  const detailsUnavailable = busy || Boolean(detailError);
  const visibleAlbums = showAll ? albums : albums.slice(0, 2);

  const header = (
    <View>
      <View style={styles.topBar}>
        <Text numberOfLines={1} style={[styles.username, { color: theme.muted }]}>@{user.username}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings" onPress={() => router.push('/settings')}
          style={({ pressed }) => [styles.circleButton, styles.settingsButton, { backgroundColor: surface, borderColor: border }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
          <Ionicons name="settings-outline" size={23} color={theme.ink} />
        </Pressable>
      </View>

      <View style={styles.identity}>
        <Animated.View entering={reduceMotion ? FadeIn.duration(120) : FadeIn.duration(350)}>
          <Pressable accessibilityRole="button" accessibilityLabel="View profile photo" onPress={() => setShowAvatar(true)}
            style={({ pressed }) => [styles.avatar, { borderColor: dark ? 'rgba(255,255,255,0.16)' : 'rgba(60,60,67,0.14)' }, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url" initials={initials} color="#FFFFFF" backgroundColor={dark ? '#52677F' : '#90A6C0'} avatar dark={dark} />
          </Pressable>
        </Animated.View>
        <Animated.View style={styles.identityCopy} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(60).duration(310).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })}>
          <Text style={[styles.name, { color: theme.ink }]}>{name}</Text>
          {bio ? <Text numberOfLines={3} style={[styles.bio, { color: theme.ink }]}>{bio}</Text> : null}
          {location ? <Text style={[styles.location, { color: theme.muted }]}><Ionicons name="location-outline" size={14} /> {location}</Text> : null}
        </Animated.View>
        <Animated.View style={styles.actions} entering={reduceMotion ? FadeIn.duration(120) : FadeIn.delay(110).duration(300)}>
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

      <Animated.View style={styles.stats} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(150).duration(320).withInitialValues({ opacity: 0, transform: [{ translateY: 4 }] })}>
        <View pointerEvents="none" style={[styles.statDivider, styles.firstStatDivider, { backgroundColor: statDivider }]} />
        <View pointerEvents="none" style={[styles.statDivider, styles.secondStatDivider, { backgroundColor: statDivider }]} />
        {[
          { value: journeysLoading ? '—' : journeys.length, label: journeys.length === 1 ? 'Journey' : 'Journeys' },
          { value: journeysLoading ? '—' : countries, label: countries === 1 ? 'Country' : 'Countries' },
          { value: detailsUnavailable ? '—' : places, label: places === 1 ? 'Place' : 'Places' },
        ].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.ink }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: theme.muted }]}>{stat.label}</Text>
          </View>
        ))}
      </Animated.View>
      {journeyError || detailError || shareError ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{journeyError || detailError || shareError}</Text> : null}

      <Animated.View style={styles.sectionRow} entering={reduceMotion ? FadeIn.duration(120) : FadeInDown.delay(190).duration(320)}>
        <Text style={[styles.sectionHeading, { color: theme.ink }]}>Your albums</Text>
        {albums.length > 2 ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showAll }} hitSlop={8}
          onPress={() => { selectionHaptic(); setShowAll((value) => !value); }} style={({ pressed }) => [styles.textButton, pressed && (reduceMotion ? styles.pressedOpacity : styles.pressed)]}>
          <Text style={[styles.link, { color: accent }]}>{showAll ? 'Show less' : 'See all'}</Text>
        </Pressable> : null}
      </Animated.View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {busy ? <ActivityIndicator style={styles.loader} color={theme.muted} accessibilityLabel="Loading travel profile" /> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Travel summary" accessibilityState={{ expanded: showSummary }}
        onPress={() => { selectionHaptic(); setShowSummary((value) => !value); }}
        style={({ pressed }) => [styles.summary, { backgroundColor: theme.glass, borderColor: theme.border }, pressed && (reduceMotion ? styles.pressedOpacity : styles.summaryPressed)]}>
        <BlurView pointerEvents="none" intensity={dark ? 34 : 24} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <Ionicons name="book-outline" size={25} color={theme.muted} />
        <View style={styles.summaryText}>
          <Text style={[styles.summaryTitle, { color: theme.ink }]}>Travel summary</Text>
          <Text style={[styles.summaryCaption, { color: theme.muted }]}>{busy ? 'Loading memories…' : detailError ? 'Some details unavailable' : `${memories} ${memories === 1 ? 'memory' : 'memories'}`}</Text>
        </View>
        <Ionicons name={showSummary ? 'chevron-up' : 'chevron-forward'} size={19} color={theme.muted} />
      </Pressable>
      {showSummary && !detailsUnavailable ? <View style={styles.summaryDetails}><TravelStatsCard journeys={albums} totalMemories={memories} theme={theme} /></View> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: theme.canvas }]}>
      <FlatList
        {...tabBarScroll}
        data={visibleAlbums}
        numColumns={2}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        columnWrapperStyle={styles.albumRow}
        ListEmptyComponent={!busy && !journeyError && !detailError ? <ProfileEmptyState icon="albums-outline" title="Your journeys will appear here." action="Create your first journey" onAction={() => router.push('/journey/new')} theme={theme} /> : null}
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
              router.push(`/journey/${item.id}`);
            }}
          />
        )}
        refreshing={refreshing}
        onRefresh={() => void pullToRefresh()}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      />
      <Modal visible={showAvatar} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setShowAvatar(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close profile photo" onPress={() => setShowAvatar(false)} style={styles.previewBackdrop}>
          <Pressable accessibilityRole="image" accessibilityLabel={`${name}'s profile photo`} onPress={(event) => event.stopPropagation()} style={styles.previewPhoto}>
            <Photo source={user.profile_photo_url} label="user.profile_photo_url:preview" initials={initials} color="#FFFFFF" backgroundColor="transparent" avatar dark={dark} />
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
  topBar: { paddingHorizontal: 20, height: 56, alignItems: 'center', justifyContent: 'center' },
  username: { maxWidth: '65%', fontFamily: 'System', fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.3, textAlign: 'center' },
  circleButton: { width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  settingsButton: { position: 'absolute', right: 20 },
  pressed: { opacity: 0.65, transform: [{ scale: 0.97 }] },
  pressedOpacity: { opacity: 0.65 },
  identity: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 4 },
  identityCopy: { alignItems: 'center' },
  avatar: { width: 108, height: 108, borderRadius: 54, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 12 },
  photo: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  photoLoading: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  previewBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.86)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  previewPhoto: { width: '100%', maxWidth: 390, aspectRatio: 1, borderRadius: 28, overflow: 'hidden' },
  previewClose: { position: 'absolute', top: 58, right: 22, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'System', fontSize: 31, fontWeight: '600', letterSpacing: -1 },
  name: { fontFamily: 'System', fontSize: 27, fontWeight: '700', letterSpacing: -0.8, textAlign: 'center' },
  bio: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 10 },
  location: { fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 15 },
  editButton: { minHeight: 46, minWidth: 145, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 25, justifyContent: 'center', alignItems: 'center' },
  editLabel: { fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', marginHorizontal: 27, marginTop: 18, marginBottom: 8, alignItems: 'center' },
  statDivider: { position: 'absolute', top: '50%', width: 1, height: 44, marginTop: -22 },
  firstStatDivider: { left: '33.333%' },
  secondStatDivider: { left: '66.666%' },
  stat: { flex: 1, alignItems: 'center', paddingHorizontal: 5 },
  statValue: { fontSize: 23, fontWeight: '600', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
  statLabel: { fontSize: 13, marginTop: 4 },
  error: { marginHorizontal: 20, marginTop: 14, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  sectionRow: { marginHorizontal: 20, marginTop: 25, marginBottom: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionHeading: { fontSize: 23, fontWeight: '700', letterSpacing: -0.6 },
  textButton: { minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 15, fontWeight: '600' },
  albumRow: { paddingHorizontal: 20, gap: 16 },
  footer: { paddingTop: 2 },
  summary: { marginHorizontal: 20, minHeight: 64, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 13, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', gap: 13 },
  summaryPressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
  summaryText: { flex: 1 },
  summaryTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.3 },
  summaryCaption: { fontSize: 12, marginTop: 3 },
  summaryDetails: { marginTop: 12 },
  loader: { marginVertical: 16 },
});

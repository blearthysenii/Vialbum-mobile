import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, LinearTransition, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { cachedImageSource } from '@/features/media/imageUrl';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import type { ProfileTheme } from '@/features/profile/theme';
import { colors } from '@/theme/colors';
import type { PublicPhoto } from '@/features/discover/types';
import type { PostJourney } from './data';
import { PublicPhotoViewer } from '@/features/discover/components/PublicPhotoViewer';
import { postContent } from './content';
import { PostTabs, PostHotelsTab, type PostTab } from './PostTabs';
import { PostMapTab } from './PostMapTab';
import { PhotoScrubber } from './PhotoScrubber';

function relativeDate(value: string) {
  const elapsed = Date.now() - Date.parse(value);
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;
  const days = Math.floor(elapsed / 86_400_000);
  if (days) return `${days}d`;
  const hours = Math.floor(elapsed / 3_600_000);
  return hours ? `${hours}h` : 'Today';
}

function photoLabel(photo: PublicPhoto | undefined, journey: PostJourney) {
  if (!photo) return journey.place?.name ?? journey.destination;
  const date = photo.captured_at;
  const day = date ? Math.floor((Date.parse(date.slice(0, 10)) - Date.parse(journey.start_date.slice(0, 10))) / 86_400_000) + 1 : null;
  const place = photo.place?.name ?? journey.place?.name ?? journey.destination;
  return [day !== null && Number.isFinite(day) && day > 0 ? `Day ${day}` : null, place].filter(Boolean).join(' · ');
}

export const PostContent = memo(function PostContent({ journey, theme, memoryId, own, onOpen, onRefresh }: {
  journey: PostJourney; theme: ProfileTheme; memoryId?: string; own: boolean; onOpen: (id: string) => void; onRefresh: () => void;
}) {
  const [active, setActive] = useState(0);
  const carousel = useRef<FlatList<PublicPhoto | null>>(null);
  const activeRef = useRef(0);
  const manualSwipe = useRef(false);
  const [tab, setTab] = useState<PostTab>('photos');
  const [mapVisited, setMapVisited] = useState(false);
  const [width, setWidth] = useState(0);
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  const [imageError, setImageError] = useState(false);
  const reduceMotion = useReducedMotion();
  const counterOpacity = useSharedValue(1);
  const counterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counterGeneration = useRef(0);
  const counterInteractions = useRef(new Set<string>());
  const clearCounterTimer = useCallback(() => {
    counterGeneration.current += 1;
    if (counterTimer.current !== null) clearTimeout(counterTimer.current);
    counterTimer.current = null;
  }, []);
  const showCounter = useCallback(() => {
    clearCounterTimer();
    counterOpacity.set(reduceMotion ? 1 : withTiming(1, { duration: 140 }));
  }, [clearCounterTimer, counterOpacity, reduceMotion]);
  const hideCounterLater = useCallback(() => {
    clearCounterTimer();
    if (counterInteractions.current.size) return;
    const generation = counterGeneration.current;
    counterTimer.current = setTimeout(() => {
      if (generation !== counterGeneration.current || counterInteractions.current.size) return;
      counterTimer.current = null;
      counterOpacity.set(reduceMotion ? 0 : withTiming(0, { duration: 230 }));
    }, 1500);
  }, [clearCounterTimer, counterOpacity, reduceMotion]);
  const beginCounterInteraction = useCallback((source: string) => {
    counterInteractions.current.add(source);
    showCounter();
  }, [showCounter]);
  const endCounterInteraction = useCallback((source: string) => {
    counterInteractions.current.delete(source);
    hideCounterLater();
  }, [hideCounterLater]);
  const onScrubStart = useCallback(() => beginCounterInteraction('scrubber'), [beginCounterInteraction]);
  const onScrubEnd = useCallback(() => endCounterInteraction('scrubber'), [endCounterInteraction]);
  const counterStyle = useAnimatedStyle(() => ({ opacity: counterOpacity.get() }));
  const { photos, photoCaption, index, journeyDescription } = postContent(journey, active, memoryId);
  useEffect(() => {
    counterInteractions.current.clear();
    showCounter();
    hideCounterLater();
    return () => { clearCounterTimer(); cancelAnimation(counterOpacity); };
  }, [journey.id, memoryId, width, photos.length, showCounter, hideCounterLater, clearCounterTimer, counterOpacity]);
  const location = [...new Set([journey.place?.name ?? journey.destination, journey.country].filter(Boolean))].join(', ');
  const metadata = [location, relativeDate(journey.created_at)].filter(Boolean).join(' · ');
  const open = () => onOpen(journey.id);
  const profile = () => own ? router.push('/(tabs)/profile') : router.push(`/public-profile/${journey.creator.id}`);
  const placeId = journey.place_id;
  const place = () => { if (placeId) router.push(`/explore/place/${placeId}`); };
  const media = photos.length ? photos : [null];
  const selectPhoto = useCallback((requested: number) => {
    if (!width || !photos.length) return;
    // Dot taps/accessibility adjustments are discrete interactions. During a
    // scrub, its start/end callbacks own visibility, not individual indices.
    if (!counterInteractions.current.has('scrubber')) {
      showCounter();
      hideCounterLater();
    }
    const next = Math.max(0, Math.min(photos.length - 1, requested));
    manualSwipe.current = false;
    carousel.current?.scrollToOffset({ offset: next * width, animated: false });
    if (next === activeRef.current) return;
    activeRef.current = next;
    setActive(next);
    void Haptics.selectionAsync().catch(() => undefined);
  }, [photos.length, width, showCounter, hideCounterLater]);
  return <View style={styles.post}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={`View ${journey.creator.username}`} onPress={profile} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
        <ProfileAvatarImage source={journey.creator.avatar_url} label={journey.creator.username} cacheKey={`creator:${journey.creator.id}`} style={styles.avatar} fallbackIconSize={20} />
      </Pressable>
      <View style={styles.author}>
        <Pressable accessibilityRole="button" onPress={profile} style={({ pressed }) => pressed && styles.pressed}><Text numberOfLines={1} style={[styles.name, { color: theme.ink }]}>{journey.creator.display_name || journey.creator.username}</Text></Pressable>
        {metadata ? <Pressable disabled={!placeId || own} accessibilityRole={placeId && !own ? 'button' : 'text'} onPress={place} style={({ pressed }) => pressed && styles.pressed}><Text numberOfLines={2} style={[styles.metadata, { color: theme.muted }]}>{metadata}</Text></Pressable> : null}
      </View>
    </View>
    <PostTabs active={tab} theme={theme} onChange={next => { setTab(next); if (next === 'map') setMapVisited(true); }} />
    <View style={{ display: tab === 'photos' ? 'flex' : 'none' }}>
    <View onLayout={event => { const next = event.nativeEvent.layout.width; if (next > 0 && next !== width) { setWidth(next); } }} style={[styles.media, { backgroundColor: theme.placeholder }]}>
      {width > 0 ? <FlatList ref={carousel} key={`${journey.id}:${width}:${photos.length}`} horizontal pagingEnabled directionalLockEnabled showsHorizontalScrollIndicator={false} data={media} keyExtractor={item => item?.id ?? journey.id} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3}
        initialScrollIndex={index} getItemLayout={(_, itemIndex) => ({ length: width, offset: width * itemIndex, index: itemIndex })}
        onScrollBeginDrag={() => { manualSwipe.current = true; beginCounterInteraction('scroll'); }}
        onScrollEndDrag={() => endCounterInteraction('scroll')}
        onMomentumScrollBegin={() => beginCounterInteraction('scroll')}
        onMomentumScrollEnd={event => {
          endCounterInteraction('scroll');
          if (!manualSwipe.current) return;
          manualSwipe.current = false;
          const next = Math.max(0, Math.min(media.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
          if (next !== activeRef.current) { activeRef.current = next; setActive(next); }
        }}
        renderItem={({ item }) => {
          const uri = item?.url ?? (memoryId ? null : journey.cover_media_url);
          const label = photoLabel(item ?? undefined, journey);
          return <Pressable accessibilityRole="button" accessibilityLabel={item ? 'Open journey photograph' : 'View journey'} onPress={() => item ? own ? router.push(`/journey/${journey.id}/photo/${item.id}`) : setPhoto(item) : open()} style={{ width, aspectRatio: 4 / 5 }}>
            {uri ? <Image source={cachedImageSource(uri, item ? `public-photo:${item.id}` : `discover:${journey.id}`)} recyclingKey={item?.id ?? journey.id} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={reduceMotion ? 0 : 150} onError={() => setImageError(true)} /> : <View style={styles.noImage}><Ionicons name="image-outline" size={32} color={theme.muted} /></View>}
            {uri && label ? <><LinearGradient pointerEvents="none" colors={['transparent', colors.overlay]} style={styles.gradient} /><Text pointerEvents="none" numberOfLines={2} style={styles.eyebrow}>{label.toUpperCase()}</Text></> : null}
          </Pressable>;
        }} /> : null}
      {photos.length > 1 ? <Animated.View pointerEvents="none" style={[styles.counter, { backgroundColor: colors.overlay }, counterStyle]}><Text style={styles.counterText}>{index + 1} / {photos.length}</Text></Animated.View> : null}
    </View>
    <PhotoScrubber count={photos.length} index={index} onSelect={selectPhoto} onInteractionStart={onScrubStart} onInteractionEnd={onScrubEnd} theme={theme} />
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(180)} style={styles.copy}>
      {photoCaption ? <Text accessibilityLiveRegion="polite" style={[styles.photoCaption, { color: theme.muted }]}>{photoCaption}</Text> : null}
      {journey.title?.trim() ? <Text style={{ color: theme.ink, fontSize: 24, lineHeight: 30, fontWeight: '600', marginTop: 22 }}>{journey.title}</Text> : null}
      {journeyDescription ? <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(180)} style={[styles.journeyDescription, { borderColor: theme.divider }]}>
        <Text style={[styles.sectionLabel, { color: theme.muted }]}>ABOUT THIS JOURNEY</Text>
        <Text style={[styles.descriptionBody, { color: theme.muted }]}>{journeyDescription}</Text>
      </Animated.View> : null}
      {imageError ? <Pressable accessibilityRole="button" onPress={onRefresh} style={styles.read}><Text style={{ color: theme.muted }}>Photos couldn’t load · Refresh photos</Text></Pressable> : null}
    </Animated.View>
    </View>
    {mapVisited ? <View style={{ display: tab === 'map' ? 'flex' : 'none' }}><PostMapTab journey={journey} theme={theme} /></View> : null}
    {tab === 'hotels' ? <PostHotelsTab theme={theme} /> : null}
    <PublicPhotoViewer photo={photo} onClose={() => setPhoto(null)} />
  </View>;
});

export function PostSkeleton({ theme }: { theme: ProfileTheme }) {
  return <View accessibilityLabel="Loading post">{[0].map(key => <View key={key} style={styles.post}>
    <View style={styles.header}><View style={[styles.avatar, { backgroundColor: theme.placeholder }]} /><View style={{ width: '45%', height: 28, borderRadius: 6, backgroundColor: theme.placeholder }} /></View>
    <View style={[styles.media, { backgroundColor: theme.placeholder }]} />
    <View style={{ width: '65%', height: 26, marginTop: 26, borderRadius: 6, backgroundColor: theme.placeholder }} />
  </View>)}</View>;
}

const styles = StyleSheet.create({
  post: { paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  avatarButton: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, avatar: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden' },
  author: { flex: 1, minWidth: 0 }, name: { fontSize: 17, fontWeight: '600', lineHeight: 23 }, metadata: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  menu: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  media: { width: '100%', aspectRatio: 4 / 5, borderRadius: 22, overflow: 'hidden', borderCurve: 'continuous' }, noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%' }, eyebrow: { position: 'absolute', bottom: 20, left: 20, right: 20, color: colors.onDark, fontSize: 10, lineHeight: 16, letterSpacing: 1.8, fontWeight: '600' },
  indicator: { height: 26, justifyContent: 'center' }, dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, dot: { width: 5, height: 5, borderRadius: 3 },
  copy: { paddingHorizontal: 3 }, title: { fontSize: 27, lineHeight: 33, fontWeight: '500', letterSpacing: -0.8 }, caption: { fontSize: 15, lineHeight: 24, marginTop: 10 }, read: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  counter: { position: 'absolute', top: 14, right: 14, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16 }, counterText: { color: colors.onDark, fontSize: 12, lineHeight: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
  photoCaption: { fontSize: 16, lineHeight: 24 },
  sectionLabel: { fontSize: 11, lineHeight: 17, fontWeight: '600', letterSpacing: 1.5, marginBottom: 10 },
  journeyDescription: { marginTop: 22 },
  descriptionBody: { fontSize: 16, lineHeight: 25 },
  journeyRow: { borderRadius: 20, marginTop: 18, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }, journeyLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, thumbnail: { width: 44, height: 44, borderRadius: 11, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, journeyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '600' }, pressed: { opacity: 0.65 },
});

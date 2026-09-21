import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Pressable, ScrollView, SectionList, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { readPreparedJourneyDetails, storePreparedJourneyDetails } from '@/features/journeys/detailsCache';
import type { Journey } from '@/features/journeys/types';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import { safeExportFilename, type ExportState } from '@/features/exports/utils';
import { mediaApi } from '@/features/media/api';
import { PhotoUploader } from '@/features/media/components/PhotoUploader';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import { MemoryEditor } from '@/features/memories/components/MemoryEditor';
import type { Memory } from '@/features/memories/types';
import { formatPlaceContext } from '@/features/places/utils';
import { JourneyStats } from '@/features/journeys/components/JourneyStats';
import { deriveJourneySummary } from '@/features/journeys/summary';
import { groupTimeline, type TimelineItem, type TimelineSection } from '@/features/timeline/groupTimeline';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates, formatDateRange } from '@/utils/format';

const AnimatedTimelineSectionList = Animated.createAnimatedComponent(
  SectionList<TimelineItem, TimelineSection>,
);

function GlassActionButton({
  children,
  onPress,
  accessibilityLabel,
  disabled = false,
  destructive = false,
}: PropsWithChildren<{
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  destructive?: boolean;
}>) {
  const pressProgress = useRef(new Animated.Value(1)).current;
  const animatePress = (toValue: number) => Animated.timing(pressProgress, {
    toValue,
    duration: toValue < 1 ? 120 : 160,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();

  return <Animated.View style={{ opacity: pressProgress, transform: [{ scale: pressProgress.interpolate({ inputRange: [0.9, 1], outputRange: [0.98, 1] }) }] }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => animatePress(0.9)}
      onPressOut={() => animatePress(1)}
      style={[timelineStyles.glassButton, disabled && timelineStyles.glassButtonDisabled]}
    >
      <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={timelineStyles.glassButtonTint} />
      <Text style={[timelineStyles.glassButtonLabel, destructive && timelineStyles.glassButtonDanger]}>{children}</Text>
    </Pressable>
  </Animated.View>;
}

function AnimatedPhotoCard({ photo, onPress }: { photo: JourneyMedia; onPress: () => void }) {
  const pressScale = useRef(new Animated.Value(1)).current;
  const animatePress = (toValue: number) => Animated.timing(pressScale, {
    toValue,
    duration: 130,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();

  return <Animated.View style={{ transform: [{ scale: pressScale }] }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={photo.caption ? `Open journey photo: ${photo.caption}` : 'Open journey photo'}
      onPress={onPress}
      onPressIn={() => animatePress(0.985)}
      onPressOut={() => animatePress(1)}
      style={timelineStyles.photo}
    >
      <Image
        source={cachedImageSource(photo.thumbnail_url ?? photo.url, `journey-photo:${photo.id}`)}
        style={timelineStyles.image}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={photo.id}
        transition={180}
      />
      {photo.caption ? <BlurView intensity={42} tint="systemThinMaterialDark" style={timelineStyles.photoCaptionOverlay}>
        <Text numberOfLines={2} style={timelineStyles.photoCaptionText}>{photo.caption}</Text>
      </BlurView> : null}
    </Pressable>
  </Animated.View>;
}

// Retained outside the router; normal Journey entry now uses Post Detail.
export default function JourneyDetailsScreen() {
  const { id, memoryId } = useLocalSearchParams<{ id: string; memoryId?: string }>();
  const preparedDetails = useRef(readPreparedJourneyDetails(id)).current;
  const listRef = useRef<SectionList<TimelineItem, TimelineSection>>(null);
  const lastFocusedMemory = useRef<string | null>(null);
  const { journeys, fetchOne, remove } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(preparedDetails?.journey ?? journeys.find((item) => item.id === id) ?? null);
  const [error, setError] = useState(false);
  const [media, setMedia] = useState<JourneyMedia[]>(preparedDetails?.media ?? []);
  const [memories, setMemories] = useState<Memory[]>(preparedDetails?.memories ?? []);
  const [loading, setLoading] = useState(!preparedDetails);
  const [statsReady, setStatsReady] = useState(Boolean(preparedDetails));
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ memory: Memory | null } | null>(null);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [coverLoaded, setCoverLoaded] = useState(Boolean(preparedDetails));
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const contentOpacity = useRef(new Animated.Value(preparedDetails ? 1 : 0)).current;
  const heroEntranceScale = useRef(new Animated.Value(1.025)).current;
  const panelOpacity = useRef(new Animated.Value(0)).current;
  const panelTranslateY = useRef(new Animated.Value(12)).current;
  const storyOpacity = useRef(new Animated.Value(0)).current;
  const storyTranslateY = useRef(new Animated.Value(10)).current;
  const exportOpacity = useRef(new Animated.Value(0)).current;
  const exportTranslateY = useRef(new Animated.Value(10)).current;
  const momentsOpacity = useRef(new Animated.Value(0)).current;
  const momentsTranslateY = useRef(new Animated.Value(12)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const backPressScale = useRef(new Animated.Value(1)).current;
  const editPressScale = useRef(new Animated.Value(1)).current;
  const hasPlayedEntrance = useRef(false);
  const skipInitialPreparedRefresh = useRef(Boolean(preparedDetails));
  const floatingNavY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const isDragging = useRef(false);
  const isFloatingNavVisible = useRef(true);

  const setFloatingNavVisible = useCallback((visible: boolean) => {
    if (isFloatingNavVisible.current === visible) return;
    isFloatingNavVisible.current = visible;
    Animated.spring(floatingNavY, {
      toValue: visible ? 0 : -160,
      damping: 22,
      stiffness: 240,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [floatingNavY]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextY = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = nextY - lastScrollY.current;

    if (isDragging.current) {
      if (nextY <= 8) setFloatingNavVisible(true);
      else if (delta > 1) setFloatingNavVisible(false);
      else if (delta < -1) setFloatingNavVisible(true);
    }

    lastScrollY.current = nextY;
  }, [setFloatingNavVisible]);

  const animatedScrollHandler = useMemo(() => Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true, listener: handleScroll },
  ), [handleScroll, scrollY]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (preparedDetails) return;
    void fetchOne(id).then(setJourney).catch(() => setError(true));
  }, [fetchOne, id, preparedDetails]);
  useEffect(() => {
    const updatedJourney = journeys.find((item) => item.id === id);
    if (updatedJourney) {
      setJourney((current) => !current || updatedJourney.updated_at >= current.updated_at ? updatedJourney : current);
    }
  }, [id, journeys]);

  useEffect(() => {
    if (preparedDetails) return;
    setCoverLoaded(false);
    setStatsReady(false);
    contentOpacity.setValue(0);
  }, [contentOpacity, id, preparedDetails]);

  const refreshTimeline = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setTimelineError(null);
    const [photosResult, memoriesResult] = await Promise.allSettled([
      mediaApi.list(id),
      memoryApi.list(id),
    ]);
    if (!isActive()) return;
    if (photosResult.status === 'fulfilled') setMedia(photosResult.value);
    if (memoriesResult.status === 'fulfilled') setMemories(memoriesResult.value);
    if (photosResult.status === 'fulfilled' && memoriesResult.status === 'fulfilled') {
      setStatsReady(true);
    }
    if (photosResult.status === 'rejected' || memoriesResult.status === 'rejected') {
      setTimelineError('Some journey moments could not be loaded. Please try again.');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (skipInitialPreparedRefresh.current) {
      skipInitialPreparedRefresh.current = false;
      return;
    }
    let active = true;
    void refreshTimeline(() => active);
    return () => { active = false; };
  }, [refreshTimeline]));

  const sections = useMemo(
    () => groupTimeline(journey?.start_date ?? '', memories, media),
    [journey?.start_date, media, memories],
  );
  const summary = useMemo(
    () => journey ? deriveJourneySummary(journey, memories, media) : null,
    [journey, media, memories],
  );
  const coverPhoto = journey ? media.find((photo) => photo.id === journey.cover_media_id) : undefined;
  const coverUrl = journey?.cover_media_url ?? coverPhoto?.thumbnail_url;

  useEffect(() => {
    if (journey && !coverUrl) setCoverLoaded(true);
  }, [coverUrl, journey]);

  useEffect(() => {
    if (!journey || !statsReady) return;
    storePreparedJourneyDetails({ journey, memories, media });
  }, [journey, media, memories, statsReady]);

  useEffect(() => {
    if (!coverLoaded || !statsReady) return;
    contentOpacity.setValue(1);
  }, [contentOpacity, coverLoaded, statsReady]);

  useEffect(() => {
    if (!coverLoaded || !statsReady || reduceMotion === null || hasPlayedEntrance.current) return;
    hasPlayedEntrance.current = true;

    if (reduceMotion) {
      heroEntranceScale.setValue(1);
      panelOpacity.setValue(1);
      panelTranslateY.setValue(0);
      storyOpacity.setValue(1);
      storyTranslateY.setValue(0);
      exportOpacity.setValue(1);
      exportTranslateY.setValue(0);
      momentsOpacity.setValue(1);
      momentsTranslateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(heroEntranceScale, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelOpacity, {
        toValue: 1,
        duration: 380,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(panelTranslateY, {
        toValue: 0,
        duration: 380,
        delay: 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(storyOpacity, {
        toValue: 1,
        duration: 320,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(storyTranslateY, {
        toValue: 0,
        duration: 360,
        delay: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exportOpacity, {
        toValue: 1,
        duration: 320,
        delay: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(exportTranslateY, {
        toValue: 0,
        duration: 360,
        delay: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(momentsOpacity, {
        toValue: 1,
        duration: 360,
        delay: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(momentsTranslateY, {
        toValue: 0,
        duration: 400,
        delay: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    coverLoaded,
    exportOpacity,
    exportTranslateY,
    heroEntranceScale,
    momentsOpacity,
    momentsTranslateY,
    panelOpacity,
    panelTranslateY,
    reduceMotion,
    statsReady,
    storyOpacity,
    storyTranslateY,
  ]);

  const animateControlPress = (value: Animated.Value, pressed: boolean) => Animated.timing(value, {
    toValue: pressed ? 0.95 : 1,
    duration: pressed ? 110 : 150,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  }).start();

  const entranceReady = coverLoaded && statsReady && reduceMotion !== null;
  const heroParallax = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 30],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!memoryId || loading || lastFocusedMemory.current === memoryId) return;
    const sectionIndex = sections.findIndex((section) =>
      section.data.some((item) => item.type === 'memory' && item.id === memoryId));
    if (sectionIndex < 0) return;
    const itemIndex = sections[sectionIndex].data.findIndex((item) =>
      item.type === 'memory' && item.id === memoryId);
    const timer = setTimeout(() => {
      listRef.current?.scrollToLocation({
        sectionIndex,
        itemIndex,
        viewPosition: 0.42,
        animated: true,
      });
      lastFocusedMemory.current = memoryId;
    }, 250);
    return () => clearTimeout(timer);
  }, [loading, memoryId, sections]);

  function confirmDelete() {
    Alert.alert(
      'Delete this journey?',
      'This album and its memories will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void remove(id).then(() => router.replace('/')),
        },
      ],
    );
  }

  async function runExport(includeMedia: boolean) {
    if (!journey || exportState !== 'idle') return;
    try {
      await exportApi.journey(
        journey.id,
        includeMedia,
        safeExportFilename(journey.title, journey.start_date.slice(0, 4)),
        setExportState,
      );
    } catch (caught) {
      Alert.alert('Export unavailable', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setExportState('idle');
    }
  }

  function chooseExport() {
    Alert.alert(
      'Export Journey',
      'Create a private, portable ZIP with your journey data. Choose whether to include photo files.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Data Only', onPress: () => void runExport(false) },
        { text: 'Data + Photos', onPress: () => void runExport(true) },
      ],
    );
  }

  function renderItem({ item }: { item: TimelineItem }) {
    if (item.type === 'memory') {
      const itemLocation = item.memory.place
        ? formatPlaceContext(item.memory.place) || item.memory.place.display_name
        : formatCoordinates(item.memory.latitude, item.memory.longitude);
      return <Pressable
        accessibilityLabel={`Open memory: ${item.memory.title}`}
        onPress={() => router.push({ pathname: '/post/[id]', params: { id, scope: 'own', memoryId: item.memory.id } })}
        onLongPress={() => setEditor({ memory: item.memory })}
        style={timelineStyles.memoryShell}
      >
        <View style={[timelineStyles.memory, item.id === memoryId && timelineStyles.memorySelected]}>
          <BlurView pointerEvents="none" intensity={42} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={timelineStyles.memoryGlassTint} />
          <View pointerEvents="none" style={timelineStyles.memoryTopHighlight} />
          <BlurView intensity={36} tint="systemUltraThinMaterialLight" style={timelineStyles.memoryBadge}>
            <Ionicons name="book-outline" size={17} color={colors.accent} />
            <Text style={timelineStyles.memoryBadgeText}>Memory</Text>
          </BlurView>
          <Text style={timelineStyles.title}>{item.memory.title}</Text>
          {item.memory.caption ? <Text style={timelineStyles.caption}>{item.memory.caption}</Text> : null}
          {itemLocation ? <BlurView intensity={38} tint="systemUltraThinMaterialLight" style={timelineStyles.memoryLocation}>
            <Ionicons name="location" size={17} color={colors.muted} />
            <Text numberOfLines={1} style={timelineStyles.memoryLocationText}>{itemLocation}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </BlurView> : null}
          <BlurView intensity={36} tint="systemUltraThinMaterialLight" style={timelineStyles.memoryEdit}>
            <Ionicons name="pencil-outline" size={16} color={colors.accent} />
            <Text style={timelineStyles.edit}>View memory</Text>
          </BlurView>
        </View>
      </Pressable>;
    }
    return null;
  }

  function renderPhotoCarousel(section: TimelineSection) {
    const photos = section.data.filter(
      (item): item is Extract<TimelineItem, { type: 'photo' }> => item.type === 'photo',
    );

    if (photos.length === 0) return null;

    return <ScrollView
      horizontal
      contentContainerStyle={timelineStyles.photoTrack}
      showsHorizontalScrollIndicator={false}
    >
      {photos.map((item) => <AnimatedPhotoCard
        key={item.id}
        photo={item.photo}
        onPress={() => router.push(`/journey/${id}/photo/${item.id}` as never)}
      />)}
    </ScrollView>;
  }

  if (!journey && !error) return <View style={styles.loading}><LoadingState label="Opening your journey…" /></View>;
  if (!journey) return <SafeAreaView style={styles.loading}><EmptyState title="This journey could not be opened." message="It may be unavailable right now. Please return to your journeys and try again." actionLabel="Go Back" onAction={() => router.back()} /></SafeAreaView>;

  const location = journey.place
    ? formatPlaceContext(journey.place) || journey.place.display_name
    : [journey.destination, journey.country].filter(Boolean).join(', ');

  return <View style={styles.safe}>
    {coverUrl ? <View pointerEvents="none" style={styles.timelineBackdrop}>
      <Image
        source={cachedImageSource(coverUrl, `timeline-background:${journey.id}`)}
        style={[StyleSheet.absoluteFill, styles.timelineBackdropImage]}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={`timeline-background:${journey.cover_media_id ?? journey.id}`}
        blurRadius={46}
        onLoad={() => setCoverLoaded(true)}
        onError={() => setCoverLoaded(true)}
      />
      <BlurView intensity={48} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
      <View style={styles.timelineBackdropWash} />
    </View> : null}
    <Animated.View pointerEvents={coverLoaded ? 'auto' : 'none'} style={[styles.content, { opacity: contentOpacity }]}>
    <AnimatedTimelineSectionList
      style={styles.timelineList}
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      refreshing={loading}
      onRefresh={() => void refreshTimeline()}
      onScroll={animatedScrollHandler}
      onScrollBeginDrag={() => { isDragging.current = true; }}
      onScrollEndDrag={() => { isDragging.current = false; }}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      renderSectionHeader={({ section }) => <View style={timelineStyles.day}>
        <Text style={timelineStyles.dayTitle}>Day {section.day}</Text>
        <Text style={timelineStyles.dayDate}>{formatCalendarDate(section.date)}</Text>
      </View>}
      renderSectionFooter={({ section }) => renderPhotoCarousel(section)}
      ListHeaderComponent={<>
        <View style={styles.cover}>
          {coverUrl ? <Animated.View pointerEvents="none" style={[
            styles.coverImageMotion,
            {
              transform: [
                { translateY: reduceMotion ? 0 : heroParallax },
                { scale: reduceMotion ? 1 : heroEntranceScale },
              ],
            },
          ]}>
            <Image source={cachedImageSource(coverUrl, `journey-hero:${journey.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={journey.cover_media_id ?? journey.id} />
          </Animated.View> : <View style={styles.fallback}><View style={styles.sun} /></View>}
          <View style={styles.coverShade} />
          <SafeAreaView style={styles.coverSafe} edges={['top']}>
            <View>
              <Text style={styles.country}>{journey.country.toUpperCase()}</Text>
              <Text style={styles.title}>{journey.title}</Text>
              <Text style={styles.destination}>{location}</Text>
              <Text style={styles.dates}>{formatDateRange(journey.start_date, journey.end_date)} · {summary?.durationDays} {summary?.durationDays === 1 ? 'day' : 'days'}</Text>
            </View>
          </SafeAreaView>
        </View>
        <Animated.View style={[timelineStyles.headerShell, { opacity: panelOpacity, transform: [{ translateY: panelTranslateY }] }]}>
          <View style={timelineStyles.header}>
            <BlurView
              pointerEvents="none"
              intensity={34}
              tint="systemUltraThinMaterialLight"
              style={timelineStyles.headerTopBlur}
            />
            <LinearGradient
              pointerEvents="none"
              colors={[
                'rgba(255,255,255,0.54)',
                'rgba(255,255,255,0.46)',
                'rgba(255,255,255,0.34)',
                'rgba(255,255,255,0.22)',
                'rgba(255,255,255,0.12)',
                'rgba(255,255,255,0.05)',
                'rgba(255,255,255,0.00)',
              ]}
              locations={[0, 0.14, 0.30, 0.48, 0.66, 0.84, 1]}
              style={StyleSheet.absoluteFill}
            />
            {journey.description ? <Text style={styles.description}>{journey.description}</Text> : null}
            {summary ? <JourneyStats summary={summary} glass animate={entranceReady} reduceMotion={Boolean(reduceMotion)} /> : null}
            <Animated.View style={{ opacity: storyOpacity, transform: [{ translateY: storyTranslateY }] }}>
            </Animated.View>
            <Animated.View style={{ opacity: exportOpacity, transform: [{ translateY: exportTranslateY }] }}>
              <GlassActionButton accessibilityLabel="Export this journey" disabled={exportState !== 'idle'} onPress={chooseExport}>Export Journey</GlassActionButton>
            </Animated.View>

            <Animated.View style={[timelineStyles.momentsReveal, { opacity: momentsOpacity, transform: [{ translateY: momentsTranslateY }] }]}>
              <View style={styles.rule} />

              <View style={timelineStyles.momentsSection}>
              <View style={timelineStyles.momentsHeading}>
                <Text style={styles.section}>Memories & Photos</Text>
                <Text style={timelineStyles.momentsSubtitle}>
                  Build your journey one moment at a time.
                </Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add memory"
                disabled={loading}
                onPress={() => setEditor({ memory: null })}
                style={({ pressed }) => [
                  timelineStyles.actionCard,
                  pressed && !loading && timelineStyles.actionCardPressed,
                  loading && timelineStyles.actionCardDisabled,
                ]}
              >
                <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={timelineStyles.actionCardTint} />
                <BlurView style={timelineStyles.actionIcon} intensity={36} tint="systemUltraThinMaterialLight">
                  <Ionicons name="book-outline" size={22} color="#111111" />
                </BlurView>

                <View style={timelineStyles.actionCopy}>
                  <Text style={timelineStyles.actionTitle}>Add Memory</Text>
                  <Text style={timelineStyles.actionSubtitle}>
                    Write down a story, thought, or special moment.
                  </Text>
                </View>

                <View style={timelineStyles.actionChevron}>
                  <Ionicons name="chevron-forward" size={18} color="#8E8E93" />
                </View>
              </Pressable>

              <View style={timelineStyles.photosCard}>
                <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
                <View pointerEvents="none" style={timelineStyles.actionCardTint} />
                <View style={timelineStyles.photosIntro}>
                  <BlurView style={timelineStyles.actionIcon} intensity={36} tint="systemUltraThinMaterialLight">
                    <Ionicons name="images-outline" size={22} color="#111111" />
                  </BlurView>

                  <View style={timelineStyles.actionCopy}>
                    <Text style={timelineStyles.actionTitle}>Photos</Text>
                    <Text style={timelineStyles.actionSubtitle}>
                      Add the photos that make this journey yours.
                    </Text>
                  </View>
                </View>

                <View style={timelineStyles.photoUploaderWrap}>
                  <PhotoUploader
                    journeyId={id}
                    buttonStyle={timelineStyles.addPhotosButton}
                    glassButton
                    onUploaded={(photo) =>
                      setMedia((current) => [
                        ...current.filter((item) => item.id !== photo.id),
                        photo,
                      ])
                    }
                  />
                </View>
              </View>
            </View>
            </Animated.View>

            {timelineError ? <ErrorBanner message={timelineError} onRetry={() => void refreshTimeline()} /> : null}
          </View>

        </Animated.View>
      </>}
      ListEmptyComponent={loading
        ? <LoadingState label="Gathering memories…" />
        : !timelineError
          ? <EmptyState title="Your journey starts here." message="Add a memory or photographs to begin your timeline." />
          : null}
      ListFooterComponent={<View style={timelineStyles.footer}><GlassActionButton destructive onPress={confirmDelete}>Delete Journey</GlassActionButton></View>}
    />
    <SafeAreaView pointerEvents="box-none" edges={['top']} style={styles.floatingNavSafe}>
      <Animated.View pointerEvents="box-none" style={[styles.nav, { transform: [{ translateY: floatingNavY }] }]}>
        <Animated.View style={{ transform: [{ scale: backPressScale }] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} onPressIn={() => animateControlPress(backPressScale, true)} onPressOut={() => animateControlPress(backPressScale, false)} style={styles.glassBack}>
            <BlurView pointerEvents="none" intensity={40} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.editGlassTint} />
            <Ionicons name="chevron-back" size={25} color={colors.ink} />
          </Pressable>
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: editPressScale }] }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit journey" onPress={() => router.push({ pathname: '/journey/edit/[id]', params: { id } })} onPressIn={() => animateControlPress(editPressScale, true)} onPressOut={() => animateControlPress(editPressScale, false)} style={styles.edit}>
            <BlurView pointerEvents="none" intensity={40} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={styles.editGlassTint} />
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </SafeAreaView>
    </Animated.View>
    {editor ? <MemoryEditor
      journeyId={id}
      initialDate={journey.start_date}
      memory={editor.memory}
      onClose={() => setEditor(null)}
      onSaved={(memory) => setMemories((current) => [...current.filter((item) => item.id !== memory.id), memory])}
      onDeleted={(deletedMemoryId) => {
        setMemories((current) => current.filter((item) => item.id !== deletedMemoryId));
        setMedia((current) => current.map((photo) =>
          photo.memory_id === deletedMemoryId ? { ...photo, memory_id: null } : photo));
      }}
    /> : null}
    <ExportProgress state={exportState} />
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.glassCanvas },
  content: { flex: 1 },
  timelineBackdrop: { position: 'absolute', inset: 0, overflow: 'hidden' },
  timelineBackdropImage: { opacity: 0.64 },
  timelineBackdropWash: { position: 'absolute', inset: 0, backgroundColor: 'rgba(245,245,245,0.10)' },
  timelineList: { backgroundColor: 'transparent' },
  loading: { flex: 1, backgroundColor: colors.glassCanvas, alignItems: 'center', justifyContent: 'center' },
  cover: { height: 500, backgroundColor: '#657063', overflow: 'hidden' },
  coverImageMotion: { position: 'absolute', top: -18, left: -8, right: -8, bottom: -18 },
  fallback: { position: 'absolute', inset: 0, backgroundColor: '#657063' },
  coverShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17,17,13,0.3)' },
  sun: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#D4B57F', right: -40, top: 70, opacity: 0.8 },
  coverSafe: { flex: 1, padding: 20, justifyContent: 'flex-end' },
  floatingNavSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 },
  nav: { paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  glassBack: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  edit: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radii.round, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.5)', overflow: 'hidden' },
  editGlassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.12)' },
  editText: { ...typography.button, color: colors.ink },
  country: { ...typography.eyebrow, color: colors.onDark },
  title: { ...typography.display, color: colors.onDark, fontSize: 48, lineHeight: 51, marginTop: 7 },
  destination: { ...typography.bodyLarge, color: colors.onDark, marginTop: spacing.sm },
  dates: { ...typography.metadata, color: 'rgba(255,255,255,0.84)', marginTop: spacing.xs, marginBottom: 14 },
  description: { ...typography.cardTitle, color: colors.ink, lineHeight: 29 },
  muted: { ...typography.body, color: colors.muted },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: spacing.sm },
  section: { ...typography.sectionTitle, color: colors.ink },
});

const timelineStyles = StyleSheet.create({
  glassButton: { minHeight: 50, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.46)' },
  glassButtonTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  glassButtonLabel: { ...typography.button, color: colors.ink },
  glassButtonDanger: { color: colors.danger },
  glassButtonPressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  glassButtonDisabled: { opacity: 0.5 },
  headerShell: { marginTop: -32 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 118, gap: spacing.lg, borderTopLeftRadius: 34, borderTopRightRadius: 34, backgroundColor: 'transparent', overflow: 'hidden' },
  headerTopBlur: { position: 'absolute', top: 0, left: 0, right: 0, height: 150, borderTopLeftRadius: 34, borderTopRightRadius: 34, overflow: 'hidden' },
      day: { paddingHorizontal: spacing.lg, paddingTop: 8, paddingBottom: spacing.md, gap: 3 },
  dayTitle: { ...typography.screenTitle, color: colors.ink, fontSize: 34, lineHeight: 39 },
  dayDate: { ...typography.bodyLarge, color: colors.muted },
  title: { ...typography.cardTitle, color: colors.ink },
  memoryShell: { marginHorizontal: spacing.lg, marginBottom: 14, borderRadius: 30, shadowColor: '#171713', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.09, shadowRadius: 22, elevation: 3 },
  memory: { padding: 20, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.46)', gap: 12, overflow: 'hidden' },
  memoryGlassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  memoryTopHighlight: { position: 'absolute', top: 0, left: 22, right: 22, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.72)' },
  memorySelected: { borderWidth: 2, borderColor: colors.accent },
  memoryBadge: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 13, borderRadius: radii.round, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
  memoryBadgeText: { ...typography.body, color: colors.accent, fontWeight: '700' },
  caption: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  memoryLocation: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 38, paddingHorizontal: 12, borderRadius: radii.round, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
  memoryLocationText: { ...typography.body, color: colors.ink, flexShrink: 1 },
  memoryEdit: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 13, borderRadius: radii.round, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.4)', overflow: 'hidden' },
  edit: { ...typography.metadata, color: colors.accent },
  photoTrack: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, gap: 12 },
  photo: { width: 190, height: 278, borderRadius: 24, overflow: 'hidden', backgroundColor: '#E1DDD3', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.72)' },
  image: { width: '100%', height: '100%', backgroundColor: '#E1DDD3' },
  photoCaptionOverlay: { position: 'absolute', left: 8, right: 8, bottom: 8, minHeight: 42, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(17,17,13,0.22)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.26)', overflow: 'hidden' },
  photoCaptionText: { ...typography.metadata, color: colors.onDark, lineHeight: 17 },
  momentsReveal: {
    gap: spacing.lg,
  },
  momentsSection: {
    gap: 12,
  },
  momentsHeading: {
    gap: 5,
    marginBottom: 4,
  },
  momentsSubtitle: {
    ...typography.body,
    color: '#7C7C80',
    lineHeight: 21,
  },
  actionCard: {
    minHeight: 92,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.44)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    overflow: 'hidden',
  },
  actionCardTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  actionCardPressed: {
    transform: [{ scale: 0.988 }],
    opacity: 0.82,
  },
  actionCardDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.44)',
    overflow: 'hidden',
  },
  actionCopy: {
    flex: 1,
    minWidth: 0,
  },
  actionTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#111111',
  },
  actionSubtitle: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 19,
    color: '#7C7C80',
  },
  actionChevron: {
    width: 22,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  photosCard: {
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.44)',
    padding: 14,
    gap: 14,
    overflow: 'hidden',
  },
  photosIntro: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingHorizontal: 2,
  },
  photoUploaderWrap: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.38)',
  },
  addPhotosButton: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20 },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: 60, paddingTop: spacing.xl },
});

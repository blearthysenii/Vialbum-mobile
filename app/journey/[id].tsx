import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DestructiveButton, QuietButton, SecondaryButton } from '@/components/ui/Button';
import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { BackButton } from '@/components/ui/Headers';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import type { Journey } from '@/features/journeys/types';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import { safeExportFilename, type ExportState } from '@/features/exports/utils';
import { mediaApi } from '@/features/media/api';
import { PhotoUploader } from '@/features/media/components/PhotoUploader';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import { MemoryEditor } from '@/features/memories/components/MemoryEditor';
import type { Memory } from '@/features/memories/types';
import { formatPlaceContext } from '@/features/places/utils';
import { JourneyStats } from '@/features/recap/components/JourneyStats';
import { deriveJourneySummary } from '@/features/recap/summary';
import { groupTimeline, type TimelineItem, type TimelineSection } from '@/features/timeline/groupTimeline';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates, formatDateRange } from '@/utils/format';

export default function JourneyDetailsScreen() {
  const { id, memoryId } = useLocalSearchParams<{ id: string; memoryId?: string }>();
  const listRef = useRef<SectionList<TimelineItem, TimelineSection>>(null);
  const lastFocusedMemory = useRef<string | null>(null);
  const { journeys, fetchOne, remove } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(journeys.find((item) => item.id === id) ?? null);
  const [error, setError] = useState(false);
  const [media, setMedia] = useState<JourneyMedia[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ memory: Memory | null } | null>(null);
  const [exportState, setExportState] = useState<ExportState>('idle');

  useEffect(() => {
    void fetchOne(id).then(setJourney).catch(() => setError(true));
  }, [fetchOne, id]);
  useEffect(() => {
    const updatedJourney = journeys.find((item) => item.id === id);
    if (updatedJourney) setJourney(updatedJourney);
  }, [id, journeys]);

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
    if (photosResult.status === 'rejected' || memoriesResult.status === 'rejected') {
      setTimelineError('Some journey moments could not be loaded. Please try again.');
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => {
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
        accessibilityLabel={`Edit memory: ${item.memory.title}`}
        onPress={() => setEditor({ memory: item.memory })}
        style={[timelineStyles.memory, item.id === memoryId && timelineStyles.memorySelected]}
      >
        <Text style={timelineStyles.eyebrow}>MEMORY</Text>
        <Text style={timelineStyles.title}>{item.memory.title}</Text>
        {item.memory.caption ? <Text style={timelineStyles.caption}>{item.memory.caption}</Text> : null}
        {itemLocation ? <Text style={styles.muted}>{itemLocation}</Text> : null}
        <Text style={timelineStyles.edit}>Edit memory</Text>
      </Pressable>;
    }
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open journey photo"
      onPress={() => router.push(`/journey/${id}/photo/${item.id}` as never)}
      style={timelineStyles.photo}
    >
      <Image source={item.photo.thumbnail_url ?? item.photo.url} style={timelineStyles.image} contentFit="cover" cachePolicy="disk" recyclingKey={item.id} transition={180} />
      {item.photo.caption ? <Text style={timelineStyles.photoCaption}>{item.photo.caption}</Text> : null}
    </Pressable>;
  }

  if (!journey && !error) return <LoadingState fullScreen label="Opening your journey…" />;
  if (!journey) return <SafeAreaView style={styles.loading}><EmptyState title="This journey could not be opened." message="It may be unavailable right now. Please return to your journeys and try again." actionLabel="Go Back" onAction={() => router.back()} /></SafeAreaView>;

  const coverPhoto = media.find((photo) => photo.id === journey.cover_media_id);
  const coverUrl = coverPhoto?.thumbnail_url ?? journey.cover_media_url;
  const location = journey.place
    ? formatPlaceContext(journey.place) || journey.place.display_name
    : [journey.destination, journey.country].filter(Boolean).join(', ');

  return <View style={styles.safe}>
    <SectionList<TimelineItem, TimelineSection>
      ref={listRef}
      sections={sections}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      refreshing={loading}
      onRefresh={() => void refreshTimeline()}
      showsVerticalScrollIndicator={false}
      renderSectionHeader={({ section }) => <View style={timelineStyles.day}>
        <Text style={timelineStyles.title}>Day {section.day}</Text>
        <Text style={styles.muted}>{formatCalendarDate(section.date)}</Text>
      </View>}
      ListHeaderComponent={<>
        <View style={styles.cover}>
          {coverUrl ? <Image source={coverUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={journey.cover_media_id ?? journey.id} /> : <View style={styles.fallback}><View style={styles.sun} /></View>}
          <View style={styles.coverShade} />
          <SafeAreaView style={styles.coverSafe} edges={['top']}>
            <View style={styles.nav}>
              <BackButton light onPress={() => router.back()} />
              <Pressable accessibilityRole="button" accessibilityLabel="Edit journey" onPress={() => router.push({ pathname: '/journey/edit/[id]', params: { id } })} style={styles.edit}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            </View>
            <View>
              <Text style={styles.country}>{journey.country.toUpperCase()}</Text>
              <Text style={styles.title}>{journey.title}</Text>
              <Text style={styles.destination}>{location}</Text>
              <Text style={styles.dates}>{formatDateRange(journey.start_date, journey.end_date)} · {summary?.durationDays} {summary?.durationDays === 1 ? 'day' : 'days'}</Text>
            </View>
          </SafeAreaView>
        </View>
        <View style={timelineStyles.header}>
          {journey.description ? <Text style={styles.description}>{journey.description}</Text> : null}
          {summary ? <JourneyStats summary={summary} /> : null}
          <SecondaryButton accessibilityLabel="View journey story" onPress={() => router.push({ pathname: '/journey/[id]/recap', params: { id } })}>View Story</SecondaryButton>
          <QuietButton accessibilityLabel="Export this journey" disabled={exportState !== 'idle'} onPress={chooseExport}>Export Journey</QuietButton>
          <View style={styles.rule} />
          <Text style={styles.section}>Memories & Photos</Text>
          <QuietButton disabled={loading} style={timelineStyles.add} onPress={() => setEditor({ memory: null })}>Add Memory</QuietButton>
          <PhotoUploader journeyId={id} onUploaded={(photo) => setMedia((current) => [...current.filter((item) => item.id !== photo.id), photo])} />
          {timelineError ? <ErrorBanner message={timelineError} onRetry={() => void refreshTimeline()} /> : null}
        </View>
      </>}
      ListEmptyComponent={loading
        ? <LoadingState label="Gathering memories…" />
        : !timelineError
          ? <EmptyState title="Your journey starts here." message="Add a memory or photographs to begin your timeline." />
          : null}
      ListFooterComponent={<View style={timelineStyles.footer}><DestructiveButton onPress={confirmDelete}>Delete Journey</DestructiveButton></View>}
    />
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
  safe: { flex: 1, backgroundColor: colors.canvas },
  loading: { flex: 1, backgroundColor: colors.canvas },
  cover: { height: 500, backgroundColor: '#657063', overflow: 'hidden' },
  fallback: { position: 'absolute', inset: 0, backgroundColor: '#657063' },
  coverShade: { position: 'absolute', inset: 0, backgroundColor: 'rgba(17,17,13,0.3)' },
  sun: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: '#D4B57F', right: -40, top: 70, opacity: 0.8 },
  coverSafe: { flex: 1, padding: 20, justifyContent: 'space-between' },
  nav: { flexDirection: 'row', justifyContent: 'space-between' },
  edit: { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radii.round, minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
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
  header: { padding: spacing.lg, gap: spacing.lg },
  day: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 12, gap: 5 },
  title: { ...typography.cardTitle, color: colors.ink },
  memory: { marginHorizontal: spacing.lg, marginBottom: 12, padding: 20, borderRadius: radii.lg, backgroundColor: colors.surfaceWarm, gap: 8 },
  memorySelected: { borderWidth: 2, borderColor: colors.accent },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  caption: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  edit: { ...typography.metadata, color: colors.accent, marginTop: 5 },
  photo: { marginHorizontal: spacing.lg, marginBottom: 12, borderRadius: radii.md, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.3, backgroundColor: '#E1DDD3' },
  photoCaption: { ...typography.body, padding: 14, backgroundColor: colors.surfaceWarm, color: colors.ink },
  add: { alignSelf: 'flex-start', marginVertical: spacing.xs },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: 60, paddingTop: spacing.xl },
});

import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { BackButton } from '@/components/ui/Headers';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import type { Journey } from '@/features/journeys/types';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import type { Memory } from '@/features/memories/types';
import { formatPlaceContext } from '@/features/places/utils';
import { JourneyStats } from '@/features/recap/components/JourneyStats';
import {
  buildRecapSections,
  deriveJourneySummary,
  selectJourneyHighlights,
} from '@/features/recap/summary';
import type { TimelineItem, TimelineSection } from '@/features/timeline/groupTimeline';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatDateRange } from '@/utils/format';

function readableLocation(item: Memory | JourneyMedia) {
  return item.place ? formatPlaceContext(item.place) || item.place.display_name : null;
}

export default function JourneyRecapScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journeys, fetchOne } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(journeys.find((item) => item.id === id) ?? null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [media, setMedia] = useState<JourneyMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (active: () => boolean = () => true) => {
    setError(false);
    try {
      const [nextJourney, nextMemories, nextMedia] = await Promise.all([
        fetchOne(id),
        memoryApi.list(id),
        mediaApi.list(id),
      ]);
      if (active()) {
        setJourney(nextJourney);
        setMemories(nextMemories);
        setMedia(nextMedia);
      }
    } catch {
      if (active()) setError(true);
    } finally {
      if (active()) setLoading(false);
    }
  }, [fetchOne, id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const summary = useMemo(
    () => journey ? deriveJourneySummary(journey, memories, media) : null,
    [journey, media, memories],
  );
  const sections = useMemo(
    () => journey ? buildRecapSections(journey.start_date, memories, media) : [],
    [journey, media, memories],
  );
  const fullSections = useMemo(
    () => journey ? buildRecapSections(journey.start_date, memories, media, Number.MAX_SAFE_INTEGER) : [],
    [journey, media, memories],
  );
  const highlights = useMemo(
    () => journey ? selectJourneyHighlights(journey, fullSections) : [],
    [fullSections, journey],
  );
  const relatedPhotoCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const photo of media) {
      if (photo.memory_id) counts.set(photo.memory_id, (counts.get(photo.memory_id) ?? 0) + 1);
    }
    return counts;
  }, [media]);

  if (!journey && loading) return <LoadingState fullScreen label="Composing your story…" />;
  if (!journey) return <SafeAreaView style={styles.safe}><EmptyState title="This story could not be opened." message="Return to your journey and try again." actionLabel="Go Back" onAction={() => router.back()} /></SafeAreaView>;

  const coverPhoto = media.find((photo) => photo.id === journey.cover_media_id);
  const heroUrl = coverPhoto?.thumbnail_url ?? coverPhoto?.url ?? journey.cover_media_url;
  const location = journey.place
    ? formatPlaceContext(journey.place) || journey.place.display_name
    : [journey.destination, journey.country].filter(Boolean).join(', ');

  function renderItem({ item }: { item: TimelineItem }) {
    if (item.type === 'memory') {
      const relatedCount = relatedPhotoCounts.get(item.id) ?? 0;
      const itemLocation = readableLocation(item.memory);
      return <View style={styles.memory}>
        <Text style={styles.memoryKind}>MEMORY</Text>
        <Text style={styles.memoryTitle}>{item.memory.title}</Text>
        {item.memory.caption ? <Text style={styles.memoryCopy}>{item.memory.caption}</Text> : null}
        {itemLocation ? <Text style={styles.itemMeta}>{itemLocation}</Text> : null}
        {relatedCount > 0 ? <Text style={styles.itemMeta}>{relatedCount} related {relatedCount === 1 ? 'photograph' : 'photographs'}</Text> : null}
      </View>;
    }
    const itemLocation = readableLocation(item.photo);
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.photo.caption ? `Open photo: ${item.photo.caption}` : 'Open journey photo'}
      onPress={() => router.push(`/journey/${id}/photo/${item.id}` as never)}
      style={styles.photo}
    >
      <Image
        source={item.photo.thumbnail_url ?? item.photo.url}
        style={styles.photoImage}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={item.id}
        transition={160}
      />
      {item.photo.caption || itemLocation ? <View style={styles.photoCopy}>
        {item.photo.caption ? <Text style={styles.photoCaption}>{item.photo.caption}</Text> : null}
        {itemLocation ? <Text style={styles.itemMeta}>{itemLocation}</Text> : null}
      </View> : null}
    </Pressable>;
  }

  const header = <View>
    <View style={styles.hero}>
      {heroUrl ? <Image source={heroUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={journey.cover_media_id ?? journey.id} /> : <View style={styles.fallback}><View style={styles.sun} /></View>}
      <View style={styles.shade} />
      <SafeAreaView style={styles.heroSafe} edges={['top']}>
        <BackButton light onPress={() => router.back()} />
        <View>
          <Text style={styles.eyebrow}>JOURNEY STORY</Text>
          <Text style={styles.heroTitle}>{journey.title}</Text>
          <Text style={styles.heroMeta}>{location}</Text>
          <Text style={styles.heroMeta}>{formatDateRange(journey.start_date, journey.end_date)} · {summary?.durationDays} {summary?.durationDays === 1 ? 'day' : 'days'}</Text>
        </View>
      </SafeAreaView>
    </View>
    <View style={styles.intro}>
      {journey.description ? <Text style={styles.description}>{journey.description}</Text> : null}
      {summary ? <JourneyStats summary={summary} /> : null}
      {highlights.length > 0 ? <View>
        <Text style={styles.sectionEyebrow}>HIGHLIGHTS</Text>
        <Text style={styles.sectionTitle}>Moments to remember</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.highlights}>
          {highlights.map((photo) => <Pressable accessibilityRole="button" accessibilityLabel="Open highlighted photo" key={photo.id} onPress={() => router.push(`/journey/${id}/photo/${photo.id}` as never)} style={styles.highlight}>
            <Image source={photo.thumbnail_url ?? photo.url} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={`highlight:${photo.id}`} />
            {photo.caption ? <View style={styles.highlightShade}><Text numberOfLines={2} style={styles.highlightCaption}>{photo.caption}</Text></View> : null}
          </Pressable>)}
        </ScrollView>
      </View> : null}
      <View><Text style={styles.sectionEyebrow}>DAY BY DAY</Text><Text style={styles.sectionTitle}>The journey unfolds</Text></View>
      {error ? <ErrorBanner message="Some story details could not be loaded." onRetry={() => void load()} /> : null}
    </View>
  </View>;

  return <View style={styles.safe}>
    <SectionList<TimelineItem, TimelineSection>
      sections={sections}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      renderItem={renderItem}
      renderSectionHeader={({ section }) => <View style={styles.dayHeader}>
        <Text style={styles.dayNumber}>Day {section.day}</Text>
        <Text style={styles.dayDate}>{formatCalendarDate(section.date, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
      </View>}
      ListHeaderComponent={header}
      ListEmptyComponent={!loading ? <View style={styles.storyEmpty}><Text style={styles.storyEmptyTitle}>A quiet beginning.</Text><Text style={styles.storyEmptyCopy}>Add memories or photographs to let this story unfold.</Text></View> : null}
      ListFooterComponent={<View style={styles.footer}><Text style={styles.footerMark}>V</Text><Text style={styles.footerCopy}>A journey remembered.</Text></View>}
      stickySectionHeadersEnabled={false}
      refreshing={loading}
      onRefresh={() => void load()}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={5}
      showsVerticalScrollIndicator={false}
    />
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  hero: { height: 560, overflow: 'hidden', backgroundColor: '#667064' },
  fallback: { ...StyleSheet.absoluteFillObject, backgroundColor: '#667064' },
  sun: { position: 'absolute', width: 340, height: 340, borderRadius: 170, right: -70, top: 95, backgroundColor: '#D5B276', opacity: 0.85 },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(13,13,10,0.34)' },
  heroSafe: { flex: 1, justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.xl },
  eyebrow: { ...typography.eyebrow, color: colors.onDark },
  heroTitle: { ...typography.display, color: colors.onDark, fontSize: 52, lineHeight: 54, marginTop: spacing.sm },
  heroMeta: { ...typography.body, color: 'rgba(255,255,255,0.88)', marginTop: spacing.xs },
  intro: { padding: spacing.lg, gap: spacing.xl },
  description: { ...typography.sectionTitle, color: colors.ink, lineHeight: 34 },
  sectionEyebrow: { ...typography.eyebrow, color: colors.accent },
  sectionTitle: { ...typography.sectionTitle, color: colors.ink, marginTop: spacing.xs },
  highlights: { gap: spacing.sm, paddingTop: spacing.md, paddingRight: spacing.lg },
  highlight: { width: 190, height: 240, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceWarm, justifyContent: 'flex-end' },
  highlightShade: { padding: spacing.md, paddingTop: spacing.xl, backgroundColor: 'rgba(17,17,13,0.52)' },
  highlightCaption: { ...typography.body, color: colors.onDark },
  dayHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.md, backgroundColor: colors.canvas },
  dayNumber: { ...typography.sectionTitle, color: colors.ink },
  dayDate: { ...typography.metadata, color: colors.muted, marginTop: spacing.xs },
  memory: { marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceWarm },
  memoryKind: { ...typography.eyebrow, color: colors.accent },
  memoryTitle: { ...typography.cardTitle, color: colors.ink, marginTop: spacing.sm },
  memoryCopy: { ...typography.bodyLarge, color: colors.ink, marginTop: spacing.sm },
  itemMeta: { ...typography.metadata, color: colors.muted, marginTop: spacing.sm },
  photo: { marginHorizontal: spacing.lg, marginBottom: spacing.md, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: colors.surfaceWarm },
  photoImage: { width: '100%', aspectRatio: 1.22, backgroundColor: colors.surfaceWarm },
  photoCopy: { padding: spacing.md },
  photoCaption: { ...typography.bodyLarge, color: colors.ink },
  storyEmpty: { padding: spacing.xxl, alignItems: 'center' },
  storyEmptyTitle: { ...typography.sectionTitle, color: colors.ink },
  storyEmptyCopy: { ...typography.body, color: colors.muted, textAlign: 'center', marginTop: spacing.sm },
  footer: { alignItems: 'center', paddingVertical: 70 },
  footerMark: { width: 48, height: 48, borderRadius: 24, textAlign: 'center', textAlignVertical: 'center', paddingTop: 10, overflow: 'hidden', backgroundColor: colors.ink, color: colors.onDark, fontSize: 18, fontWeight: '900' },
  footerCopy: { ...typography.metadata, color: colors.muted, marginTop: spacing.md },
});

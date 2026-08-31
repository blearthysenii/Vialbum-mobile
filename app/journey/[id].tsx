import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import type { Journey } from '@/features/journeys/types';
import { mediaApi } from '@/features/media/api';
import { PhotoUploader } from '@/features/media/components/PhotoUploader';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import { MemoryEditor } from '@/features/memories/components/MemoryEditor';
import type { Memory } from '@/features/memories/types';
import { groupTimeline, type TimelineItem, type TimelineSection } from '@/features/timeline/groupTimeline';
import { colors } from '@/theme/colors';

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function JourneyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journeys, fetchOne, remove } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(journeys.find((item) => item.id === id) ?? null);
  const [error, setError] = useState(false);
  const [media, setMedia] = useState<JourneyMedia[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ memory: Memory | null } | null>(null);

  useEffect(() => { void fetchOne(id).then(setJourney).catch(() => setError(true)); }, [fetchOne, id]);
  useEffect(() => {
    const updatedJourney = journeys.find((item) => item.id === id);
    if (updatedJourney) setJourney(updatedJourney);
  }, [id, journeys]);

  const refreshTimeline = useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setTimelineError(null);
    const [photosResult, memoriesResult] = await Promise.allSettled([mediaApi.list(id), memoryApi.list(id)]);
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
  const sections = useMemo(() => groupTimeline(journey?.start_date ?? '', memories, media), [journey?.start_date, memories, media]);

  function confirmDelete() { Alert.alert('Delete this journey?', 'This album and its memories will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove(id).then(() => router.replace('/')) }]); }

  function renderItem({ item }: { item: TimelineItem }) {
    if (item.type === 'memory') return <Pressable accessibilityLabel={`Edit memory: ${item.memory.title}`} onPress={() => setEditor({ memory: item.memory })} style={timelineStyles.memory}>
      <Text style={timelineStyles.eyebrow}>MEMORY</Text><Text style={timelineStyles.title}>{item.memory.title}</Text>
      {item.memory.caption ? <Text style={timelineStyles.caption}>{item.memory.caption}</Text> : null}
      {item.memory.latitude !== null || item.memory.longitude !== null ? <Text style={styles.muted}>{item.memory.latitude ?? '—'}, {item.memory.longitude ?? '—'}</Text> : null}
      <Text style={timelineStyles.edit}>Edit memory</Text>
    </Pressable>;
    return <Pressable accessibilityLabel="Open journey photo" onPress={() => router.push(`/journey/${id}/photo/${item.id}` as never)} style={timelineStyles.photo}>
      <Image source={item.photo.thumbnail_url ?? item.photo.url} style={timelineStyles.image} contentFit="cover" cachePolicy="disk" recyclingKey={item.id} transition={180} />
      {item.photo.caption ? <Text style={timelineStyles.photoCaption}>{item.photo.caption}</Text> : null}
    </Pressable>;
  }

  if (!journey && !error) return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  if (!journey) return <SafeAreaView style={styles.loading}><Text style={styles.error}>This journey could not be opened.</Text><Pressable onPress={() => router.back()}><Text style={styles.action}>Go Back</Text></Pressable></SafeAreaView>;
  return <View style={styles.safe}>
    <SectionList<TimelineItem, TimelineSection>
      sections={sections}
      keyExtractor={(item) => `${item.type}:${item.id}`}
      renderItem={renderItem}
      stickySectionHeadersEnabled={false}
      refreshing={loading}
      onRefresh={() => void refreshTimeline()}
      showsVerticalScrollIndicator={false}
      renderSectionHeader={({ section }) => <View style={timelineStyles.day}><Text style={timelineStyles.title}>Day {section.day}</Text><Text style={styles.muted}>{formatDate(section.date)}</Text></View>}
      ListHeaderComponent={<>
        <View style={styles.cover}>{journey.cover_media_url ? <Image source={journey.cover_media_url} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : <View style={styles.sun} />}<View style={styles.coverShade} /><SafeAreaView style={styles.coverSafe} edges={['top']}><View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.round}><Text style={styles.back}>‹</Text></Pressable><Pressable onPress={() => router.push({ pathname: '/journey/edit/[id]', params: { id } })} style={styles.edit}><Text style={styles.editText}>Edit</Text></Pressable></View><View><Text style={styles.country}>{journey.country.toUpperCase()}</Text><Text style={styles.title}>{journey.title}</Text><Text style={styles.destination}>{journey.destination} · {formatDate(journey.start_date)} — {formatDate(journey.end_date)}</Text></View></SafeAreaView></View>
        <View style={timelineStyles.header}>
          {journey.description ? <Text style={styles.description}>{journey.description}</Text> : <Text style={styles.muted}>No description yet.</Text>}
          <View style={styles.rule} /><Text style={styles.section}>Memories & Photos</Text>
          <Pressable disabled={loading} style={timelineStyles.add} onPress={() => setEditor({ memory: null })}><Text style={styles.action}>＋ Add Memory</Text></Pressable>
          <PhotoUploader journeyId={id} onUploaded={(photo) => setMedia((current) => [...current.filter((item) => item.id !== photo.id), photo])} />
          {timelineError ? <View><Text accessibilityRole="alert" style={timelineStyles.error}>{timelineError}</Text><Pressable onPress={() => void refreshTimeline()}><Text style={styles.action}>Try Again</Text></Pressable></View> : null}
        </View>
      </>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.accent} /> : !timelineError ? <View style={timelineStyles.day}><Text style={timelineStyles.title}>Your journey starts here.</Text><Text style={styles.muted}>Add a memory or photographs to begin your timeline.</Text></View> : null}
      ListFooterComponent={<View style={timelineStyles.footer}><Pressable onPress={confirmDelete} style={styles.delete}><Text style={styles.deleteText}>Delete Journey</Text></Pressable></View>}
    />
    {editor ? <MemoryEditor journeyId={id} initialDate={journey.start_date} memory={editor.memory} onClose={() => setEditor(null)}
      onSaved={(memory) => setMemories((current) => [...current.filter((item) => item.id !== memory.id), memory])}
      onDeleted={(memoryId) => { setMemories((current) => current.filter((item) => item.id !== memoryId)); setMedia((current) => current.map((photo) => photo.memory_id === memoryId ? { ...photo, memory_id: null } : photo)); }} /> : null}
  </View>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 16 }, cover: { height: 470, backgroundColor: '#657063', overflow: 'hidden' }, coverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,13,0.26)' }, sun: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#D4B57F', right: -40, top: 70, opacity: 0.75 }, coverSafe: { flex: 1, padding: 20, justifyContent: 'space-between' }, nav: { flexDirection: 'row', justifyContent: 'space-between' }, round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }, back: { color: colors.ink, fontSize: 34, lineHeight: 36 }, edit: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 21, paddingHorizontal: 18, justifyContent: 'center' }, editText: { color: colors.ink, fontWeight: '800' }, country: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { color: '#FFF', fontSize: 48, lineHeight: 51, fontWeight: '800', letterSpacing: -1.8, marginTop: 7 }, destination: { color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 14 }, body: { padding: 24, paddingBottom: 60 }, description: { color: colors.ink, fontSize: 20, lineHeight: 29 }, muted: { color: colors.muted, fontSize: 15, lineHeight: 22 }, rule: { height: 1, backgroundColor: colors.line, marginVertical: 28 }, section: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.7 }, mediaLoading: { marginVertical: 32 }, delete: { alignSelf: 'center', marginTop: 42, padding: 12 }, deleteText: { color: '#A33D2D', fontWeight: '800' }, error: { color: colors.ink, fontSize: 18, fontWeight: '700' }, action: { color: colors.accent, fontWeight: '800' } });


const timelineStyles = StyleSheet.create({
  header: { padding: 24 }, day: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 12, gap: 5 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink }, memory: { marginHorizontal: 24, marginBottom: 12, padding: 20, borderRadius: 18, backgroundColor: '#E8E3D8', gap: 8 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 }, caption: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  edit: { color: colors.accent, fontSize: 12, marginTop: 5 }, photo: { marginHorizontal: 24, marginBottom: 12, borderRadius: 12, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 1.3, backgroundColor: '#E1DDD3' }, photoCaption: { padding: 14, backgroundColor: '#E8E3D8', color: colors.ink, fontSize: 15, lineHeight: 21 }, add: { paddingVertical: 16 }, error: { color: '#A33D2D', marginVertical: 12 }, footer: { paddingBottom: 60 },
});

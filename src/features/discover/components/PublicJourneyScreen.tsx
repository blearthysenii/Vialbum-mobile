import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError } from '@/api/client';
import { cachedImageSource } from '@/features/media/imageUrl';
import { useProfileTheme } from '@/features/profile/theme';
import { formatCalendarDate, formatDateRange } from '@/utils/format';
import { discoverApi } from '../api';
import type { PublicJourneyDetail, PublicPhoto } from '../types';
import { publicTimeline } from '../timeline';
import { CreatorRow } from './CreatorRow';
import { DiscoverError, DiscoverSkeletons } from './DiscoverFeedback';
import { PublicJourneyMap } from './PublicJourneyMap';
import { PublicPhotoViewer } from './PublicPhotoViewer';
import { SaveJourneyButton } from '@/features/savedJourneys/SaveJourneyButton';
import { postTarget } from '@/features/posts/data';

export function PublicJourneyScreen({ id }: { id: string }) {
  const theme = useProfileTheme();
  const [journey, setJourney] = useState<PublicJourneyDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [photo, setPhoto] = useState<PublicPhoto | null>(null);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setJourney(null);
    setPhoto(null);
    setError(null);
    void discoverApi.detail(id, controller.signal).then((next) => {
      if (active) setJourney(next);
    }).catch((caught: unknown) => {
      if (!active) return;
      if (caught instanceof ApiError && (caught.status === 404 || caught.status === 401)) {
        setJourney(null); setPhoto(null);
        setError('This journey is no longer available. It may have been made private or removed.');
      } else setError(caught instanceof Error ? caught.message : 'Could not load this journey.');
    });
    return () => { active = false; controller.abort(); setJourney(null); setPhoto(null); };
    // Retry deliberately restarts authorization for the same journey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retry]));
  const timeline = useMemo(() => journey ? publicTimeline(journey) : [], [journey]);
  return <SafeAreaView style={[styles.screen, { backgroundColor: theme.canvas }]} edges={['top', 'bottom']}>
    <View style={styles.nav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={[styles.back, { backgroundColor: theme.glassStrong }]}><Ionicons name="chevron-back" size={24} color={theme.ink} /></Pressable>
      <Text style={[styles.navTitle, { color: theme.ink }]}>Journey</Text>
      {journey ? <SaveJourneyButton journey={journey} /> : <View style={styles.back} />}
    </View>
    <FlatList data={timeline} keyExtractor={(item) => item.id} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}
      ListHeaderComponent={<View>
        {error ? <DiscoverError message={error} theme={theme} onRetry={() => setRetry((value) => value + 1)} /> : null}
        {!journey && !error ? <DiscoverSkeletons theme={theme} /> : null}
        {journey ? <>
          {journey.cover_media_url ? <Image source={cachedImageSource(journey.cover_media_url, `public-cover:${id}`)} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" /> : null}
          <Text style={[styles.country, { color: theme.muted }]}>{journey.destination} · {journey.country}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.ink }]}>{journey.title}</Text>
          <Text style={[styles.dates, { color: theme.muted }]}>{formatDateRange(journey.start_date, journey.end_date)}</Text>
          <CreatorRow creator={journey.creator} theme={theme} />
          {journey.description ? <Text style={[styles.description, { color: theme.ink }]}>{journey.description}</Text> : null}
          <Text style={[styles.counts, { color: theme.muted }]}>{journey.photo_count} photos · {journey.memory_count} memories</Text>
          <PublicJourneyMap journey={journey} />
          <Text style={[styles.sectionTitle, { color: theme.ink }]}>The journey</Text>
          {!timeline.length ? <Text style={[styles.description, { color: theme.muted }]}>The story is just beginning.</Text> : null}
        </> : null}
      </View>}
      renderItem={({ item }) => <View style={styles.moment}>
        <Text style={[styles.momentDate, { color: theme.muted }]}>{formatCalendarDate(item.date)}</Text>
        {item.memory ? <><Text accessibilityRole="button" onPress={() => router.push(postTarget(id, false, item.memory!.id))} style={[styles.memoryTitle, { color: theme.ink }]}>{item.memory.title}</Text>{item.memory.place ? <Text style={[styles.dates, { color: theme.muted }]}>{item.memory.place.display_name}</Text> : null}{item.memory.caption ? <Text style={[styles.description, { color: theme.ink }]}>{item.memory.caption}</Text> : null}</> : null}
        {item.photos.map((image) => <Pressable key={image.id} accessibilityRole="button" accessibilityLabel={image.caption ? `Open photo: ${image.caption}` : 'Open journey photo'} onPress={() => setPhoto(image)} style={styles.photo}>
          <Image source={cachedImageSource(image.thumbnail_url ?? image.url, `public-photo:${image.id}`)} style={{ width: '100%', aspectRatio: image.width && image.height ? Math.max(0.7, Math.min(1.5, image.width / image.height)) : 1 }} contentFit="cover" cachePolicy="memory-disk" />
          {image.caption ? <Text style={[styles.photoCaption, { color: theme.muted }]}>{image.caption}</Text> : null}
        </Pressable>)}
      </View>}
    />
    <PublicPhotoViewer photo={photo} onClose={() => setPhoto(null)} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, nav: { height: 56, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, navTitle: { fontSize: 17, fontWeight: '600' },
  content: { paddingHorizontal: 18, paddingBottom: 40 }, cover: { width: '100%', aspectRatio: 0.95, borderRadius: 24, marginTop: 8 },
  country: { marginTop: 24, fontSize: 13, fontWeight: '500' }, title: { fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -1, marginTop: 7 },
  dates: { fontSize: 13, lineHeight: 19, marginTop: 7 }, description: { fontSize: 16, lineHeight: 25, marginTop: 14 }, counts: { fontSize: 13, marginTop: 20 },
  sectionTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 32, marginBottom: 20 },
  moment: { marginBottom: 28 }, momentDate: { fontSize: 12, fontWeight: '500', marginBottom: 7 }, memoryTitle: { fontSize: 21, lineHeight: 27, fontWeight: '600' },
  photo: { marginTop: 14, borderRadius: 20, overflow: 'hidden' }, photoCaption: { fontSize: 14, lineHeight: 21, paddingTop: 9 },
});

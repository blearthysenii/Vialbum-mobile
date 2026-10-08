import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { clearDraft, listDrafts } from '@/features/journeys/draftStorage';
import type { JourneyDraft } from '@/features/journeys/draft';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { ProfileJourney } from '@/features/profile/types';
import type { ProfileTheme } from '@/features/profile/theme';
import { profileRelativeDate } from './TravelProfileContent';

export function ProfileJourneyRows({ userId, journeys, theme, onOpen, loading = false }: { loading?: boolean; userId: string; journeys: ProfileJourney[]; theme: ProfileTheme; onOpen: (journey: ProfileJourney) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [drafts, setDrafts] = useState<JourneyDraft[]>([]);
  const [showAll, setShowAll] = useState(false);
  const refreshDrafts = useCallback(() => {
    try { setDrafts(listDrafts(userId)); } catch { /* Retain readable drafts if storage fails. */ }
  }, [userId]);
  useFocusEffect(refreshDrafts);
  const resume = (draft: JourneyDraft) => router.push({ pathname: '/journey/new', params: { draftId: draft.requestId } });
  const menu = (draft: JourneyDraft) => Alert.alert(draft.values.title || 'Unfinished journey', undefined, [
    { text: 'Continue editing', onPress: () => resume(draft) },
    { text: 'Delete draft', style: 'destructive', onPress: () => Alert.alert('Delete draft?', 'This removes the saved draft and its local photos.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { void clearDraft(userId, draft).then(refreshDrafts).catch(() => Alert.alert('Could not delete draft', 'Please try again.')); } },
    ]) },
    { text: 'Cancel', style: 'cancel' },
  ]);
  const heading = (title: string, onPress: () => void) => <View style={styles.heading}><Text style={presentationTextStyle([styles.headingText, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel={`See all ${title.toLowerCase()}`} onPress={onPress} hitSlop={8}><View style={styles.seeAll}><Text style={presentationTextStyle([styles.seeAllText, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>See all</Text><Ionicons name="chevron-forward" size={13} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></View></Pressable></View>;
  const thumbnail = (journey: ProfileJourney) => {
    const source = journey.cover_media_url ?? journey.media.find(item => item.type === 'photo')?.thumbnail_url ?? journey.media.find(item => item.type === 'photo')?.url;
    return <Pressable key={journey.id} accessibilityRole="button" accessibilityLabel={`Open ${journey.title}`} onPress={() => { setShowAll(false); onOpen(journey); }} style={[styles.thumbnail, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control') }]}>{source ? <Image source={cachedImageSource(source, `journey.album.cover:${journey.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : null}</Pressable>;
  };
  return <View>
    {heading('Unfinished', () => router.push('/journey/drafts'))}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {drafts.map(draft => {
        const cover = draft.photos.find(photo => photo.key === draft.coverKey) ?? draft.photos[0];
        return <View key={draft.requestId} style={[styles.draft, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Resume ${draft.values.title || 'unfinished journey'}`} onPress={() => resume(draft)} style={StyleSheet.absoluteFill}>
            {cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
            <LinearGradient pointerEvents="none" colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,0.75)'], 'colors', 'content')} locations={[0.3, 1]} style={StyleSheet.absoluteFill} />
            <View style={styles.caption}><View style={styles.location}><Ionicons name="location-sharp" size={15} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /><Text numberOfLines={1} style={presentationTextStyle(styles.destination)}>{draft.values.destination || draft.values.country || draft.values.title || 'Untitled journey'}</Text></View><Text style={presentationTextStyle(styles.date)}>{draft.updatedAt ? profileRelativeDate(draft.updatedAt) : ''}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Journey draft options" onPress={() => menu(draft)} hitSlop={6} style={styles.menu}><Ionicons name="ellipsis-horizontal" size={19} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></Pressable>
        </View>;
      })}
    </ScrollView>
    {heading('All Journeys', () => setShowAll(true))}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>{loading && !journeys.length ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : journeys.map(thumbnail)}</ScrollView>
    <Modal visible={showAll} animationType="slide" onRequestClose={() => setShowAll(false)}><SafeAreaView style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}><View style={styles.heading}><Text style={presentationTextStyle([styles.headingText, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>All Journeys</Text><Pressable accessibilityRole="button" accessibilityLabel="Close all journeys" onPress={() => setShowAll(false)} hitSlop={12}><Ionicons name="close" size={24} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable></View><ScrollView contentContainerStyle={styles.all}>{journeys.map(thumbnail)}</ScrollView></SafeAreaView></Modal>
  </View>;
}
const styles = StyleSheet.create({
  heading: { marginHorizontal: 32, marginTop: 22, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headingText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  seeAllText: { fontSize: 12, lineHeight: 17, fontWeight: '400' },
  row: { paddingHorizontal: 32, gap: 12 },
  draft: { width: 204, height: 140, borderRadius: 16, overflow: 'hidden' },
  caption: { position: 'absolute', left: 11, right: 11, bottom: 10 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  destination: { flex: 1, fontSize: 14, lineHeight: 18, fontWeight: '600', color: '#FFFFFF' },
  date: { marginLeft: 19, marginTop: 2, fontSize: 11, lineHeight: 15, color: 'rgba(255,255,255,0.82)' },
  menu: { position: 'absolute', top: 5, right: 5, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  thumbnail: { width: 100, height: 100, borderRadius: 15, overflow: 'hidden' },
  all: { paddingHorizontal: 32, paddingBottom: 24, flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
});
const presentationBaselineStyles = styles;

import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LoadingState } from '@/components/ui/Feedback';
import { CloseButton } from '@/components/ui/Headers';
import { MetadataLine } from '@/components/ui/Metadata';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { mediaApi } from '@/features/media/api';
import { PhotoDetailsEditor } from '@/features/media/components/PhotoDetailsEditor';
import type { JourneyMedia } from '@/features/media/types';
import { photoDayNumber } from '@/features/media/utils';
import { memoryApi } from '@/features/memories/api';
import type { Memory } from '@/features/memories/types';
import { formatPlaceContext } from '@/features/places/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCoordinates, formatDateTime } from '@/utils/format';

export default function PhotoViewerScreen() {
  const { id, mediaId } = useLocalSearchParams<{ id: string; mediaId: string }>();
  const { journeys, fetchOne } = useJourneys();
  const [photo, setPhoto] = useState<JourneyMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [items, journeyMemories] = await Promise.all([mediaApi.list(id), memoryApi.list(id), fetchOne(id)]);
      setPhoto(items.find((item) => item.id === mediaId) ?? null);
      setMemories(journeyMemories);
    }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [fetchOne, id, mediaId]);
  useEffect(() => { void load(); }, [load]);

  async function setCover() {
    if (busy) return;
    setBusy(true);
    try {
      await mediaApi.setCover(id, mediaId);
      await fetchOne(id);
      Alert.alert('Album cover updated', 'This photograph now represents your journey.');
    } catch {
      Alert.alert('Could not update cover', 'Please try again.');
    } finally { setBusy(false); }
  }

  function confirmDelete() {
    Alert.alert('Delete this photo?', 'It will be removed permanently from this album.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    try {
      await mediaApi.remove(id, mediaId);
      await fetchOne(id);
      router.back();
    } catch {
      Alert.alert('Could not delete photo', 'The photograph is still safe. Please try again.');
      setBusy(false);
    }
  }

  if (loading) return <View style={styles.loading}><LoadingState label="Opening photograph…" /></View>;
  if (!photo) return <SafeAreaView style={styles.errorScreen}><EmptyState title={loadError ? 'This photograph could not be loaded.' : 'This photograph is no longer available.'} message={loadError ? 'Check your connection and try again.' : 'Return to the journey to choose another photograph.'} actionLabel={loadError ? 'Try Again' : 'Go Back'} onAction={() => loadError ? void load() : router.back()} /></SafeAreaView>;
  const journey = journeys.find((item) => item.id === id);
  const associatedMemory = memories.find((memory) => memory.id === photo.memory_id);
  const dayNumber = journey ? photoDayNumber(journey.start_date, photo.captured_at, photo.created_at) : null;
  const location = photo.place ? formatPlaceContext(photo.place) || photo.place.display_name : formatCoordinates(photo.latitude, photo.longitude);
  return <View style={styles.screen}>
    <Image source={photo.url} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={150} />
    <SafeAreaView style={styles.chrome} edges={['top', 'bottom']}>
      <CloseButton dark onPress={() => router.back()} />
      <View>
        {photo.caption ? <Text style={styles.caption}>{photo.caption}</Text> : null}
        <View style={styles.details}>
          {formatDateTime(photo.captured_at) ? <MetadataLine>{formatDateTime(photo.captured_at)}</MetadataLine> : null}
          {location ? <MetadataLine>{location}</MetadataLine> : null}
          {journey ? <MetadataLine>{journey.title}{dayNumber !== null ? ` · Day ${dayNumber}` : ''}</MetadataLine> : null}
          {associatedMemory ? <MetadataLine>Memory · {associatedMemory.title}</MetadataLine> : null}
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditingDetails(true)} style={styles.action}><Text style={styles.actionText}>Edit Details</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void setCover()} style={styles.action}><Text style={styles.actionText}>Set as Cover</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDelete} style={[styles.action, styles.delete]}><Text style={[styles.actionText, styles.deleteText]}>Delete</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
    {editingDetails ? <PhotoDetailsEditor journeyId={id} photo={photo} memories={memories} onClose={() => setEditingDetails(false)} onSaved={setPhoto} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C0C0A' }, loading: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, errorScreen: { flex: 1, backgroundColor: colors.canvas },
  chrome: { flex: 1, padding: 18, justifyContent: 'space-between' }, actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, backgroundColor: 'rgba(245,242,234,0.94)', borderRadius: radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs }, delete: { backgroundColor: 'rgba(157,48,35,0.94)' },
  actionText: { ...typography.button, color: colors.ink, fontSize: 11 }, deleteText: { color: colors.onDark },
  caption: { ...typography.bodyLarge, color: colors.onDark, backgroundColor: 'rgba(12,12,10,0.72)', borderRadius: radii.md, padding: 14, marginBottom: spacing.sm }, details: { alignSelf: 'flex-start', gap: 3, backgroundColor: 'rgba(12,12,10,0.72)', borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 7, marginBottom: spacing.sm },
});

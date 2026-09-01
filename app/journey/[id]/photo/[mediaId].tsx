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
import { PhotoCaptionEditor } from '@/features/media/components/PhotoCaptionEditor';
import type { JourneyMedia } from '@/features/media/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatDateTime } from '@/utils/format';

export default function PhotoViewerScreen() {
  const { id, mediaId } = useLocalSearchParams<{ id: string; mediaId: string }>();
  const { fetchOne } = useJourneys();
  const [photo, setPhoto] = useState<JourneyMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try { const items = await mediaApi.list(id); setPhoto(items.find((item) => item.id === mediaId) ?? null); }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [id, mediaId]);
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
  return <View style={styles.screen}>
    <Image source={photo.url} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={150} />
    <SafeAreaView style={styles.chrome} edges={['top', 'bottom']}>
      <CloseButton dark onPress={() => router.back()} />
      <View>
        {photo.caption ? <Text style={styles.caption}>{photo.caption}</Text> : null}
        {formatDateTime(photo.captured_at) ? <View style={styles.metadata}><MetadataLine>{formatDateTime(photo.captured_at)}</MetadataLine></View> : null}
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => setEditingCaption(true)} style={styles.action}><Text style={styles.actionText}>{photo.caption ? 'Edit Caption' : 'Add Caption'}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => void setCover()} style={styles.action}><Text style={styles.actionText}>Set as Cover</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={confirmDelete} style={[styles.action, styles.delete]}><Text style={[styles.actionText, styles.deleteText]}>Delete</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
    {editingCaption ? <PhotoCaptionEditor journeyId={id} photo={photo} onClose={() => setEditingCaption(false)} onSaved={setPhoto} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C0C0A' }, loading: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, errorScreen: { flex: 1, backgroundColor: colors.canvas },
  chrome: { flex: 1, padding: 18, justifyContent: 'space-between' }, actions: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, backgroundColor: 'rgba(245,242,234,0.94)', borderRadius: radii.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs }, delete: { backgroundColor: 'rgba(157,48,35,0.94)' },
  actionText: { ...typography.button, color: colors.ink, fontSize: 11 }, deleteText: { color: colors.onDark },
  caption: { ...typography.bodyLarge, color: colors.onDark, backgroundColor: 'rgba(12,12,10,0.72)', borderRadius: radii.md, padding: 14, marginBottom: spacing.sm }, metadata: { alignSelf: 'flex-start', backgroundColor: 'rgba(12,12,10,0.72)', borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 7, marginBottom: spacing.sm },
});

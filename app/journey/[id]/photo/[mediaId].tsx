import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import { mediaApi } from '@/features/media/api';
import { PhotoCaptionEditor } from '@/features/media/components/PhotoCaptionEditor';
import type { JourneyMedia } from '@/features/media/types';

export default function PhotoViewerScreen() {
  const { id, mediaId } = useLocalSearchParams<{ id: string; mediaId: string }>();
  const { fetchOne } = useJourneys();
  const [photo, setPhoto] = useState<JourneyMedia | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);

  useEffect(() => {
    void mediaApi.list(id).then((items) => setPhoto(items.find((item) => item.id === mediaId) ?? null));
  }, [id, mediaId]);

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

  if (!photo) return <View style={styles.loading}><ActivityIndicator color="#FFF" /></View>;
  return <View style={styles.screen}>
    <Image source={photo.url} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" transition={150} />
    <SafeAreaView style={styles.chrome} edges={['top', 'bottom']}>
      <Pressable onPress={() => router.back()} style={styles.circle}><Text style={styles.close}>×</Text></Pressable>
      <View>
        {photo.caption ? <Text style={styles.caption}>{photo.caption}</Text> : null}
        <View style={styles.actions}>
          <Pressable disabled={busy} onPress={() => setEditingCaption(true)} style={styles.action}><Text style={styles.actionText}>{photo.caption ? 'Edit Caption' : 'Add Caption'}</Text></Pressable>
          <Pressable disabled={busy} onPress={() => void setCover()} style={styles.action}><Text style={styles.actionText}>Set as Cover</Text></Pressable>
          <Pressable disabled={busy} onPress={confirmDelete} style={[styles.action, styles.delete]}><Text style={styles.actionText}>Delete</Text></Pressable>
        </View>
      </View>
    </SafeAreaView>
    {editingCaption ? <PhotoCaptionEditor journeyId={id} photo={photo} onClose={() => setEditingCaption(false)} onSaved={setPhoto} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0C0C0A' }, loading: { flex: 1, backgroundColor: '#0C0C0A', alignItems: 'center', justifyContent: 'center' },
  chrome: { flex: 1, padding: 18, justifyContent: 'space-between' }, circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(28,28,25,0.75)', alignItems: 'center', justifyContent: 'center' },
  close: { color: '#FFF', fontSize: 30, lineHeight: 32, fontWeight: '300' }, actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, backgroundColor: 'rgba(245,242,234,0.92)', borderRadius: 16, minHeight: 52, alignItems: 'center', justifyContent: 'center' }, delete: { backgroundColor: 'rgba(157,48,35,0.92)' },
  actionText: { color: '#11110F', fontWeight: '800', fontSize: 12 },
  caption: { color: '#FFF', backgroundColor: 'rgba(12,12,10,0.72)', borderRadius: 14, padding: 14, marginBottom: 12, fontSize: 16, lineHeight: 23 },
});

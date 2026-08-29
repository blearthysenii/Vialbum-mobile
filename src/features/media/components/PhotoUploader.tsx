import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { mediaApi } from '@/features/media/api';
import { pickPhotos } from '@/features/media/picker';
import type { JourneyMedia, SelectedPhoto } from '@/features/media/types';
import { colors } from '@/theme/colors';

type UploadItem = SelectedPhoto & {
  status: 'preparing' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
};

export function PhotoUploader({
  journeyId,
  onUploaded,
}: {
  journeyId: string;
  onUploaded: (media: JourneyMedia) => void;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isPicking, setIsPicking] = useState(false);
  const isBusy = isPicking || items.some((item) => item.status === 'uploading' || item.status === 'preparing');

  function update(key: string, values: Partial<UploadItem>) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, ...values } : item));
  }

  async function uploadOne(photo: SelectedPhoto) {
    update(photo.key, { status: 'uploading', progress: 0, error: undefined });
    try {
      const uploaded = await mediaApi.upload(journeyId, photo, (progress) => update(photo.key, { progress }));
      update(photo.key, { status: 'success', progress: 100 });
      onUploaded(uploaded);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'This photo could not be uploaded.';
      update(photo.key, { status: 'error', error: message });
    }
  }

  async function choose() {
    if (isBusy) return;
    setIsPicking(true);
    try {
      const selected = await pickPhotos();
      const queued = selected.map<UploadItem>((photo) => ({ ...photo, status: 'preparing', progress: 0 }));
      setItems(queued);
      for (const photo of selected) await uploadOne(photo);
    } catch (error) {
      Alert.alert('Photos unavailable', error instanceof Error ? error.message : 'The photo library could not be opened.');
    } finally {
      setIsPicking(false);
    }
  }

  return <View>
    <Pressable disabled={isBusy} onPress={() => void choose()} style={({ pressed }) => [styles.button, (pressed || isBusy) && styles.dim]}>
      {isPicking ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>＋  Add Photos</Text>}
    </Pressable>
    {items.length ? <View style={styles.queue}>{items.map((item) => (
      <View key={item.key} style={styles.row}>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
          <Text style={[styles.status, item.status === 'error' && styles.error]}>
            {item.status === 'preparing' ? 'Preparing…' : item.status === 'uploading' ? `Uploading ${item.progress}%` : item.status === 'success' ? 'Added to album' : item.error}
          </Text>
          {item.status === 'uploading' ? <View style={styles.track}><View style={[styles.progress, { width: `${item.progress}%` }]} /></View> : null}
        </View>
        {item.status === 'error' ? <Pressable onPress={() => void uploadOne(item)} style={styles.retry}><Text style={styles.retryText}>Retry</Text></Pressable> : null}
      </View>
    ))}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  button: { marginTop: 16, backgroundColor: colors.ink, borderRadius: 16, minHeight: 54, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.65 }, buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  queue: { marginTop: 12, gap: 7 }, row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEE9DE', borderRadius: 14, padding: 12 },
  rowCopy: { flex: 1 }, name: { color: colors.ink, fontWeight: '700', fontSize: 13 }, status: { color: colors.muted, fontSize: 12, marginTop: 3 }, error: { color: '#A33D2D' },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: '#D5CFC2', marginTop: 7 }, progress: { height: 3, backgroundColor: colors.accent },
  retry: { padding: 9 }, retryText: { color: colors.accent, fontWeight: '800', fontSize: 12 },
});

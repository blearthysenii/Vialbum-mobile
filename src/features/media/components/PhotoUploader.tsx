import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { PrimaryButton, QuietButton } from '@/components/ui/Button';
import { mediaApi } from '@/features/media/api';
import { pickPhotos } from '@/features/media/picker';
import type { JourneyMedia, SelectedPhoto } from '@/features/media/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

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
    <PrimaryButton disabled={isBusy} loading={isPicking} onPress={() => void choose()}>Add Photos</PrimaryButton>
    {items.length ? <View style={styles.queue}>{items.map((item) => (
      <View key={item.key} style={styles.row}>
        <View style={styles.rowCopy}>
          <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
          <Text style={[styles.status, item.status === 'error' && styles.error]}>
            {item.status === 'preparing' ? 'Preparing…' : item.status === 'uploading' ? `Uploading ${item.progress}%` : item.status === 'success' ? 'Added to album' : item.error}
          </Text>
          {item.status === 'uploading' ? <View style={styles.track}><View style={[styles.progress, { width: `${item.progress}%` }]} /></View> : null}
        </View>
        {item.status === 'error' ? <QuietButton onPress={() => void uploadOne(item)}>Retry</QuietButton> : null}
      </View>
    ))}</View> : null}
  </View>;
}

const styles = StyleSheet.create({
  queue: { marginTop: spacing.sm, gap: spacing.xs }, row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSubtle, borderRadius: radii.md, padding: 12 },
  rowCopy: { flex: 1 }, name: { ...typography.metadata, color: colors.ink, fontSize: 13 }, status: { ...typography.metadata, color: colors.muted, marginTop: 3 }, error: { color: colors.danger },
  track: { height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: '#D5CFC2', marginTop: 7 }, progress: { height: 3, backgroundColor: colors.accent },
});

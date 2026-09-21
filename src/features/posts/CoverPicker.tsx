import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { JourneyMedia } from '@/features/media/types';

export function CoverPicker({ photos, coverId, onCancel, onConfirm }: {
  photos: JourneyMedia[];
  coverId: string | null;
  onCancel: () => void;
  onConfirm: (id: string) => Promise<void>;
}) {
  const [pending, setPending] = useState(coverId ?? photos[0]?.id ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  async function done() {
    if (!pending || lock.current) return;
    lock.current = true;
    setSaving(true);
    setError(null);
    try { await onConfirm(pending); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not change cover. Please try again.'); }
    finally { lock.current = false; setSaving(false); }
  }
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!lock.current) onCancel(); }}>
    <SafeAreaView style={styles.sheet}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.action}><Text style={styles.actionText}>Cancel</Text></Pressable>
        <Text accessibilityRole="header" style={styles.title}>Change Cover</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving || !pending, busy: saving }} disabled={saving || !pending} onPress={() => void done()} style={styles.action}><Text style={[styles.actionText, styles.done, saving && styles.disabled]}>{saving ? 'Saving…' : 'Done'}</Text></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <FlatList data={photos} numColumns={3} keyExtractor={photo => photo.id} extraData={pending}
        contentContainerStyle={styles.grid} columnWrapperStyle={styles.row}
        renderItem={({ item, index }) => <Pressable accessibilityRole="button" accessibilityLabel={`Cover photo ${index + 1}`} accessibilityState={{ selected: pending === item.id, disabled: saving }} disabled={saving} onPress={() => setPending(item.id)} style={styles.photo}>
          <Image source={cachedImageSource(item.url, `photo-viewer:${item.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
          {pending === item.id ? <View pointerEvents="none" style={styles.selection}><View style={styles.check}><Ionicons name="checkmark" size={19} color="#FFFFFF" /></View></View> : null}
        </Pressable>}
        ListEmptyComponent={<Text style={styles.empty}>Add a photo to choose a cover.</Text>}
      />
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 60, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: '#111111' },
  action: { minWidth: 76, minHeight: 44, paddingHorizontal: 4, justifyContent: 'center' },
  actionText: { fontSize: 17, color: '#2F95FF' }, done: { textAlign: 'right', fontWeight: '600' }, disabled: { opacity: 0.5 },
  grid: { padding: 16, gap: 8 }, row: { gap: 8 },
  photo: { width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F2F2F7' },
  selection: { position: 'absolute', inset: 0, borderWidth: 3, borderColor: '#2F95FF', borderRadius: 12, backgroundColor: 'rgba(47,149,255,0.12)' },
  check: { position: 'absolute', right: 5, top: 5, width: 27, height: 27, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2F95FF' },
  error: { color: '#FF3B30', paddingHorizontal: 16, paddingBottom: 8 },
  empty: { color: '#8E8E93', paddingVertical: 24, textAlign: 'center' },
});

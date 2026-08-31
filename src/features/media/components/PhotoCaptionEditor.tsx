import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia } from '@/features/media/types';
import { colors } from '@/theme/colors';

type Props = {
  journeyId: string;
  photo: JourneyMedia;
  onClose: () => void;
  onSaved: (photo: JourneyMedia) => void;
};

export function PhotoCaptionEditor({ journeyId, photo, onClose, onSaved }: Props) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(value: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await mediaApi.updateCaption(journeyId, photo.id, value);
      onSaved(updated);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 0
        ? caught.message
        : 'The caption could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal animationType="slide" transparent onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.dismissArea} disabled={busy} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.header}>
          <Pressable disabled={busy} onPress={onClose}><Text style={styles.cancel}>Cancel</Text></Pressable>
          <Text style={styles.heading}>Photo caption</Text>
          <View style={styles.spacer} />
        </View>
        <TextInput
          accessibilityLabel="Photo caption"
          autoFocus
          editable={!busy}
          multiline
          placeholder="Write something about this photograph…"
          placeholderTextColor="#99958B"
          selectionColor={colors.accent}
          value={caption}
          onChangeText={setCaption}
          style={styles.input}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={() => void save(caption.trim() || null)} style={styles.save}>
          {busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveText}>Save Caption</Text>}
        </Pressable>
        {photo.caption ? <Pressable disabled={busy} onPress={() => void save(null)} style={styles.remove}>
          <Text style={styles.removeText}>Remove Caption</Text>
        </Pressable> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(12,12,10,0.48)' },
  dismissArea: { flex: 1 }, sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, cancel: { color: colors.accent, fontWeight: '700' },
  heading: { color: colors.ink, fontSize: 17, fontWeight: '800' }, spacer: { width: 48 },
  input: { minHeight: 112, marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: '#E8E3D8', color: colors.ink, fontSize: 17, lineHeight: 24, textAlignVertical: 'top' },
  error: { color: '#A33D2D', marginTop: 12 }, save: { minHeight: 54, marginTop: 18, borderRadius: 16, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFF', fontSize: 15, fontWeight: '800' }, remove: { alignItems: 'center', padding: 14 }, removeText: { color: '#A33D2D', fontWeight: '700' },
});

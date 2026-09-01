import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { DestructiveButton, PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia } from '@/features/media/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii } from '@/theme/tokens';

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
      setError(caught instanceof ApiError ? caught.message : 'The caption could not be saved. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <Modal animationType="slide" transparent onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.dismissArea} disabled={busy} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <SheetHeader title="Photo Caption" onClose={onClose} />
        <TextField label="Caption"
          accessibilityLabel="Photo caption"
          autoFocus
          editable={!busy}
          multiline
          placeholder="Write something about this photograph…"
          value={caption}
          onChangeText={setCaption}
          contained
        />
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton loading={busy} onPress={() => void save(caption.trim() || null)}>Save Caption</PrimaryButton>
        {photo.caption ? <DestructiveButton disabled={busy} onPress={() => void save(null)}>Remove Caption</DestructiveButton> : null}
      </SafeAreaView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  dismissArea: { flex: 1 }, sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: spacing.screen, gap: spacing.md },
});

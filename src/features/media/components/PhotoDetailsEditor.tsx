import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import { mediaApi } from '@/features/media/api';
import type { JourneyMedia, MediaUpdate } from '@/features/media/types';
import type { Memory } from '@/features/memories/types';
import { LocationPicker } from '@/features/places/components/LocationPicker';
import type { PlaceSelection } from '@/features/places/types';
import { formatPlaceContext } from '@/features/places/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCoordinates, formatDateTime } from '@/utils/format';

type Props = {
  journeyId: string;
  photo: JourneyMedia;
  memories: Memory[];
  onClose: () => void;
  onSaved: (photo: JourneyMedia) => void;
};

export function PhotoDetailsEditor({ journeyId, photo, memories, onClose, onSaved }: Props) {
  const [caption, setCaption] = useState(photo.caption ?? '');
  const [capturedAt, setCapturedAt] = useState(photo.captured_at);
  const [latitude, setLatitude] = useState(photo.latitude);
  const [longitude, setLongitude] = useState(photo.longitude);
  const [place, setPlace] = useState<PlaceSelection | null | undefined>(photo.place ?? undefined);
  const [memoryId, setMemoryId] = useState(photo.memory_id);
  const [showDate, setShowDate] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    const body: MediaUpdate = {
      caption: caption.trim() || null,
      captured_at: capturedAt,
      latitude,
      longitude,
      place,
      memory_id: memoryId,
    };
    setBusy(true); setError(null);
    try {
      const updated = await mediaApi.update(journeyId, photo.id, body);
      onSaved(updated);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Photo details could not be saved. Please try again.');
    } finally { setBusy(false); }
  }

  const selectedMemory = memories.find((memory) => memory.id === memoryId);
  return <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        <SheetHeader title="Photo Details" onClose={onClose} />
        <Text style={styles.heading}>Edit photograph</Text>
        <TextField label="Caption · optional" accessibilityLabel="Photo caption" editable={!busy} multiline placeholder="Write something about this photograph…" value={caption} onChangeText={setCaption} contained />
        <Text style={styles.label}>CAPTURE DATE & TIME</Text>
        <Pressable accessibilityRole="button" onPress={() => setShowDate((value) => !value)} style={styles.field}><Text style={styles.value}>{formatDateTime(capturedAt) ?? 'Add capture date and time'}</Text></Pressable>
        {showDate ? <DateTimePicker value={capturedAt ? new Date(capturedAt) : new Date()} mode={Platform.OS === 'ios' ? 'datetime' : 'date'} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, value) => {
          if (Platform.OS !== 'ios') setShowDate(false);
          if (event.type !== 'dismissed' && value) setCapturedAt(value.toISOString());
        }} /> : null}
        <Text style={styles.label}>LOCATION · OPTIONAL</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit photo location" onPress={() => setShowLocation(true)} style={styles.field}>
          <Text style={styles.value}>{place ? formatPlaceContext(place) || place.display_name : formatCoordinates(latitude, longitude) ?? 'Search for a place or choose a map point'}</Text>
        </Pressable>
        <Text style={styles.label}>ASSOCIATED MEMORY · OPTIONAL</Text>
        <Pressable accessibilityRole="button" onPress={() => setMemoryId(null)} style={[styles.memory, memoryId === null && styles.memorySelected]}><Text style={styles.memoryText}>No memory</Text></Pressable>
        {memories.map((memory) => <Pressable accessibilityRole="button" accessibilityState={{ selected: memoryId === memory.id }} key={memory.id} onPress={() => setMemoryId(memory.id)} style={[styles.memory, memoryId === memory.id && styles.memorySelected]}>
          <Text style={styles.memoryText}>{memory.title}</Text><Text style={styles.memoryDate}>{memory.memory_date}</Text>
        </Pressable>)}
        {selectedMemory ? <Text style={styles.hint}>Linked to “{selectedMemory.title}”.</Text> : null}
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton loading={busy} onPress={() => void save()}>Save Photo Details</PrimaryButton>
      </ScrollView>
      {showLocation ? <LocationPicker entityLabel="Photo" latitude={latitude} longitude={longitude} place={place ?? null} onCancel={() => setShowLocation(false)} onChange={(selection) => {
        if (selection) {
          setLatitude(selection.coordinate.latitude.toFixed(6));
          setLongitude(selection.coordinate.longitude.toFixed(6));
          setPlace(selection.place ?? place);
        } else {
          setLatitude(null); setLongitude(null); setPlace(place ? null : place);
        }
        setShowLocation(false);
      }} /> : null}
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: 50, gap: spacing.md },
  heading: { ...typography.screenTitle, color: colors.ink, marginVertical: spacing.sm }, label: { ...typography.eyebrow, color: colors.muted, marginTop: spacing.sm },
  field: { minHeight: 54, borderBottomWidth: 1, borderBottomColor: colors.line, justifyContent: 'center' }, value: { ...typography.bodyLarge, color: colors.ink },
  memory: { minHeight: 50, borderRadius: radii.md, backgroundColor: colors.surfaceWarm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  memorySelected: { borderWidth: 2, borderColor: colors.accent }, memoryText: { ...typography.button, color: colors.ink }, memoryDate: { ...typography.metadata, color: colors.muted },
  hint: { ...typography.metadata, color: colors.muted },
});

import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
  return <Modal
    animationType="slide"
    presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
    allowSwipeDismissal={!busy}
    onDismiss={onClose}
    onRequestClose={() => { if (!busy) onClose(); }}
  >
    <SafeAreaView style={styles.safe}>
      <BlurView pointerEvents="none" intensity={72} tint="systemMaterialLight" style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.glassWash} />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        <SheetHeader title="Photo Details" onClose={onClose} />
        <View style={styles.intro}>
          <Text style={styles.heading}>Edit photograph.</Text>
          <Text style={styles.introCopy}>Add the details that help this photograph tell its story.</Text>
        </View>
        <View style={styles.captionCard}>
          <TextField label="Caption — optional" accessibilityLabel="Photo caption" editable={!busy} multiline placeholder="Write something about this photograph…" value={caption} onChangeText={setCaption} style={styles.captionInput} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit capture date and time" onPress={() => setShowDate((value) => !value)} style={styles.optionCard}>
          <Ionicons name="calendar-outline" size={21} color={colors.muted} />
          <View style={styles.optionCopy}><Text style={styles.label}>CAPTURE DATE & TIME</Text><Text style={styles.value}>{formatDateTime(capturedAt) ?? 'Add capture date and time'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
        {showDate ? <DateTimePicker value={capturedAt ? new Date(capturedAt) : new Date()} mode={Platform.OS === 'ios' ? 'datetime' : 'date'} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, value) => {
          if (Platform.OS !== 'ios') setShowDate(false);
          if (event.type !== 'dismissed' && value) setCapturedAt(value.toISOString());
        }} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Edit photo location" onPress={() => setShowLocation(true)} style={styles.optionCard}>
          <Ionicons name="location-outline" size={21} color={colors.muted} />
          <View style={styles.optionCopy}><Text style={styles.label}>LOCATION / PLACE — OPTIONAL</Text><Text style={styles.value}>{place ? formatPlaceContext(place) || place.display_name : formatCoordinates(latitude, longitude) ?? 'Search or choose on map'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
        <View style={styles.memoryCard}>
          <Text style={styles.memoryLabel}>ASSOCIATED MEMORY — OPTIONAL</Text>
          <Pressable accessibilityRole="button" onPress={() => setMemoryId(null)} style={[styles.memory, memoryId === null && styles.memorySelected]}><Text style={styles.memoryText}>No memory</Text>{memoryId === null ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}</Pressable>
          {memories.map((memory) => <Pressable accessibilityRole="button" accessibilityState={{ selected: memoryId === memory.id }} key={memory.id} onPress={() => setMemoryId(memory.id)} style={[styles.memory, memoryId === memory.id && styles.memorySelected]}>
            <View style={styles.memoryCopy}><Text style={styles.memoryText}>{memory.title}</Text><Text style={styles.memoryDate}>{memory.memory_date}</Text></View>{memoryId === memory.id ? <Ionicons name="checkmark-circle" size={20} color={colors.accent} /> : null}
          </Pressable>)}
        </View>
        {selectedMemory ? <Text style={styles.hint}>Linked to “{selectedMemory.title}”.</Text> : null}
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton loading={busy} onPress={() => void save()} style={styles.saveButton}>Save Photo Details</PrimaryButton>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' }, glassWash: { position: 'absolute', inset: 0, backgroundColor: 'rgba(242,242,247,0.42)' }, content: { padding: spacing.lg, paddingBottom: 50, gap: 16 },
  intro: { marginTop: 4, marginBottom: 4, gap: 6 },
  heading: { ...typography.screenTitle, color: colors.ink, fontSize: 34, lineHeight: 38, letterSpacing: -0.7 },
  introCopy: { ...typography.body, color: '#7C7C80', lineHeight: 23 },
  captionCard: { minHeight: 104, borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 10, overflow: 'hidden' },
  captionInput: { minHeight: 82, borderBottomWidth: 0, paddingTop: 4, fontSize: 17, color: '#111111' },
  label: { ...typography.eyebrow, color: '#5E5E63', fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
  optionCard: { minHeight: 72, borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1, minWidth: 0 }, value: { ...typography.body, color: '#111111', fontSize: 16, lineHeight: 21, marginTop: 5 },
  memoryCard: { borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, overflow: 'hidden' },
  memoryLabel: { ...typography.eyebrow, color: '#5E5E63', fontSize: 9, lineHeight: 12, letterSpacing: 1.5, marginBottom: 6 },
  memory: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9D9DE', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  memorySelected: { backgroundColor: 'rgba(180,82,48,0.06)' }, memoryCopy: { flex: 1, minWidth: 0 }, memoryText: { ...typography.button, color: colors.ink }, memoryDate: { ...typography.metadata, color: colors.muted, marginTop: 2 },
  hint: { ...typography.metadata, color: colors.muted, paddingHorizontal: 4 },
  saveButton: { marginTop: 2, borderRadius: radii.round },
});

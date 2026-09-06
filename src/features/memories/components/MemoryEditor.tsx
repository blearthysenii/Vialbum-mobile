import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { DestructiveButton, PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import { memoryApi } from '@/features/memories/api';
import type { Memory, MemoryInput } from '@/features/memories/types';
import { LocationPicker } from '@/features/places/components/LocationPicker';
import type { PlaceSelection } from '@/features/places/types';
import { formatPlaceContext } from '@/features/places/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates } from '@/utils/format';

type Props = { journeyId: string; initialDate: string; memory: Memory | null; onClose: () => void; onSaved: (memory: Memory) => void; onDeleted: (id: string) => void };

export function MemoryEditor({ journeyId, initialDate, memory, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(memory?.title ?? '');
  const [caption, setCaption] = useState(memory?.caption ?? '');
  const [date, setDate] = useState(memory?.memory_date ?? initialDate);
  const [latitude, setLatitude] = useState<string | null>(memory?.latitude ?? null);
  const [longitude, setLongitude] = useState<string | null>(memory?.longitude ?? null);
  const [place, setPlace] = useState<PlaceSelection | null | undefined>(memory?.place ?? undefined);
  const [showLocation, setShowLocation] = useState(false);
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (busy) return;
    setError(null);
    let input: MemoryInput;
    try {
      if (!title.trim()) throw new Error('Add a title for this memory.');
      input = { title: title.trim(), caption: caption.trim() || null, memory_date: date, latitude, longitude, place };
    } catch (caught) { setError((caught as Error).message); return; }
    setBusy(true);
    try {
      const saved = memory ? await memoryApi.update(journeyId, memory.id, input) : await memoryApi.create(journeyId, input);
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The memory could not be saved. Please check your details and try again.');
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!memory || busy) return;
    setBusy(true); setError(null);
    try { await memoryApi.remove(journeyId, memory.id); onDeleted(memory.id); onClose(); }
    catch { setError('The memory could not be deleted. Please try again.'); }
    finally { setBusy(false); }
  }

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
        <SheetHeader title={memory ? 'Edit Memory' : 'New Memory'} onClose={onClose} />
        <View style={styles.intro}>
          <Text style={styles.heading}>{memory ? 'Edit memory.' : 'Add a memory.'}</Text>
          <Text style={styles.introCopy}>Keep the story, thought, or detail that made this moment yours.</Text>
        </View>
        <View style={styles.textCard}>
          <View style={styles.compactField}><TextField label="Title" accessibilityLabel="Memory title" editable={!busy} value={title} onChangeText={setTitle} maxLength={160} placeholder="A moment to remember" style={styles.compactInput} /></View>
          <View style={styles.divider} />
          <View style={styles.notesField}><TextField label="Notes — optional" accessibilityLabel="Memory notes" editable={!busy} value={caption} onChangeText={setCaption} multiline placeholder="What made this moment special?" style={styles.notesInput} /></View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={`Memory date, ${formatCalendarDate(date)}`} disabled={busy} onPress={() => setShowDate(!showDate)} style={styles.optionCard}>
          <Ionicons name="calendar-outline" size={21} color={colors.muted} />
          <View style={styles.optionCopy}><Text style={styles.label}>DATE</Text><Text style={styles.date}>{formatCalendarDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
        {showDate ? <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} disabled={busy} onChange={(event, selected) => {
          if (Platform.OS !== 'ios') setShowDate(false);
          if (event.type !== 'dismissed' && selected) setDate(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
        }} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Choose memory location" disabled={busy} onPress={() => setShowLocation(true)} style={styles.optionCard}>
          <Ionicons name="location-outline" size={21} color={colors.muted} />
          <View style={styles.optionCopy}><Text style={styles.label}>LOCATION / PLACE — OPTIONAL</Text><Text numberOfLines={2} style={styles.date}>{place ? formatPlaceContext(place) || place.display_name : formatCoordinates(latitude, longitude) ?? 'Search or choose on map'}</Text></View>
          <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
        </Pressable>
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton loading={busy} onPress={() => void save()} style={styles.saveButton}>Save Memory</PrimaryButton>
        {memory ? <DestructiveButton disabled={busy} onPress={() => Alert.alert('Delete this memory?', 'Photos will stay in your journey.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove() }])}>Delete Memory</DestructiveButton> : null}
      </ScrollView>
      {showLocation ? <LocationPicker entityLabel="Memory" latitude={latitude} longitude={longitude} place={place ?? null} onCancel={() => setShowLocation(false)} onChange={(selection) => {
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
  textCard: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, overflow: 'hidden' },
  compactField: { paddingTop: 10, paddingBottom: 4 }, notesField: { paddingTop: 10, paddingBottom: 8 },
  compactInput: { minHeight: 40, borderBottomWidth: 0, paddingVertical: 4, fontSize: 17, color: '#111111' },
  notesInput: { minHeight: 76, borderBottomWidth: 0, paddingTop: 4, fontSize: 17, color: '#111111' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#D9D9DE' },
  label: { ...typography.eyebrow, color: '#5E5E63', fontSize: 9, lineHeight: 12, letterSpacing: 1.5 },
  optionCard: { minHeight: 72, borderRadius: 24, backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionCopy: { flex: 1, minWidth: 0 }, date: { ...typography.body, color: '#111111', fontSize: 16, lineHeight: 21, marginTop: 5 },
  saveButton: { marginTop: 2, borderRadius: radii.round },
});

import DateTimePicker from '@react-native-community/datetimepicker';
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
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/tokens';
import { formatCalendarDate } from '@/utils/format';

type Props = { journeyId: string; initialDate: string; memory: Memory | null; onClose: () => void; onSaved: (memory: Memory) => void; onDeleted: (id: string) => void };

export function MemoryEditor({ journeyId, initialDate, memory, onClose, onSaved, onDeleted }: Props) {
  const [title, setTitle] = useState(memory?.title ?? '');
  const [caption, setCaption] = useState(memory?.caption ?? '');
  const [date, setDate] = useState(memory?.memory_date ?? initialDate);
  const [latitude, setLatitude] = useState(memory?.latitude ?? '');
  const [longitude, setLongitude] = useState(memory?.longitude ?? '');
  const [showDate, setShowDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function coordinate(value: string, limit: number): string | null {
    if (!value.trim()) return null;
    const number = Number(value.trim());
    if (!Number.isFinite(number) || Math.abs(number) > limit) throw new Error(`Coordinates must be between −${limit} and ${limit}.`);
    return number.toFixed(6);
  }

  async function save() {
    if (busy) return;
    setError(null);
    let input: MemoryInput;
    try {
      if (!title.trim()) throw new Error('Add a title for this memory.');
      input = { title: title.trim(), caption: caption.trim() || null, memory_date: date, latitude: coordinate(latitude, 90), longitude: coordinate(longitude, 180) };
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

  return <Modal animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        <SheetHeader title={memory ? 'Edit Memory' : 'New Memory'} onClose={onClose} />
        <Text style={styles.heading}>{memory ? 'Edit memory' : 'Add a memory'}</Text>
        <TextField label="Title" accessibilityLabel="Memory title" editable={!busy} value={title} onChangeText={setTitle} maxLength={160} placeholder="A moment to remember" />
        <Text style={styles.label}>DATE</Text><Pressable accessibilityRole="button" accessibilityLabel={`Memory date, ${formatCalendarDate(date)}`} disabled={busy} onPress={() => setShowDate(!showDate)} style={styles.input}><Text style={styles.date}>{formatCalendarDate(date, { month: 'long', day: 'numeric', year: 'numeric' })}</Text></Pressable>
        {showDate ? <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} disabled={busy} onChange={(event, selected) => {
          if (Platform.OS !== 'ios') setShowDate(false);
          if (event.type !== 'dismissed' && selected) setDate(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
        }} /> : null}
        <TextField label="Notes · optional" accessibilityLabel="Memory notes" editable={!busy} value={caption} onChangeText={setCaption} multiline contained placeholder="What made this moment special?" />
        <Text style={styles.label}>COORDINATES · OPTIONAL</Text>
        <View style={styles.coordinates}><View style={styles.coordinate}><TextField label="Latitude" editable={!busy} value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="numbers-and-punctuation" /></View><View style={styles.coordinate}><TextField label="Longitude" editable={!busy} value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="numbers-and-punctuation" /></View></View>
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton loading={busy} onPress={() => void save()}>Save Memory</PrimaryButton>
        {memory ? <DestructiveButton disabled={busy} onPress={() => Alert.alert('Delete this memory?', 'Photos will stay in your journey.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove() }])}>Delete Memory</DestructiveButton> : null}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: 50, gap: spacing.lg },
  heading: { ...typography.screenTitle, color: colors.ink, marginVertical: spacing.sm }, label: { ...typography.eyebrow, color: colors.muted },
  input: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 12, justifyContent: 'center' }, date: { ...typography.bodyLarge, color: colors.ink },
  coordinates: { flexDirection: 'row', gap: spacing.md }, coordinate: { flex: 1 },
});

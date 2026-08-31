import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { memoryApi } from '@/features/memories/api';
import type { Memory, MemoryInput } from '@/features/memories/types';
import { colors } from '@/theme/colors';

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
      setError(caught instanceof ApiError && caught.status === 0 ? caught.message : 'The memory could not be saved. Please check your details and try again.');
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable disabled={busy} onPress={onClose}><Text style={styles.action}>Cancel</Text></Pressable>
        <Text style={styles.heading}>{memory ? 'Edit memory' : 'Add a memory'}</Text>
        <Text style={styles.label}>TITLE</Text><TextInput accessibilityLabel="Memory title" editable={!busy} value={title} onChangeText={setTitle} maxLength={160} placeholder="A moment to remember" style={styles.input} />
        <Text style={styles.label}>DATE</Text><Pressable disabled={busy} onPress={() => setShowDate(!showDate)} style={styles.input}><Text style={styles.date}>{date}</Text></Pressable>
        {showDate ? <DateTimePicker value={new Date(`${date}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} disabled={busy} onChange={(event, selected) => {
          if (Platform.OS !== 'ios') setShowDate(false);
          if (event.type !== 'dismissed' && selected) setDate(`${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}-${String(selected.getDate()).padStart(2, '0')}`);
        }} /> : null}
        <Text style={styles.label}>NOTES · OPTIONAL</Text><TextInput accessibilityLabel="Memory notes" editable={!busy} value={caption} onChangeText={setCaption} multiline placeholder="What made this moment special?" style={[styles.input, styles.notes]} />
        <Text style={styles.label}>COORDINATES · OPTIONAL</Text>
        <View style={styles.coordinates}><TextInput accessibilityLabel="Latitude" editable={!busy} value={latitude} onChangeText={setLatitude} placeholder="Latitude" keyboardType="numbers-and-punctuation" style={[styles.input, styles.coordinate]} /><TextInput accessibilityLabel="Longitude" editable={!busy} value={longitude} onChangeText={setLongitude} placeholder="Longitude" keyboardType="numbers-and-punctuation" style={[styles.input, styles.coordinate]} /></View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable disabled={busy} onPress={() => void save()} style={styles.button}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Save Memory</Text>}</Pressable>
        {memory ? <Pressable disabled={busy} style={styles.delete} onPress={() => Alert.alert('Delete this memory?', 'Photos will stay in your journey.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove() }])}><Text style={styles.error}>Delete Memory</Text></Pressable> : null}
      </ScrollView>
    </KeyboardAvoidingView></SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 24, paddingBottom: 50 },
  action: { color: colors.accent, fontWeight: '700' }, heading: { fontSize: 34, fontWeight: '800', color: colors.ink, marginVertical: 30 },
  label: { color: colors.muted, fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginTop: 20 },
  input: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 12, color: colors.ink, fontSize: 18 }, date: { color: colors.ink, fontSize: 18 },
  notes: { minHeight: 100, textAlignVertical: 'top' }, coordinates: { flexDirection: 'row', gap: 16 }, coordinate: { flex: 1 },
  error: { color: '#A33D2D', marginTop: 16 }, button: { backgroundColor: colors.ink, borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 28 },
  buttonText: { color: '#FFF', fontWeight: '800', fontSize: 16 }, delete: { alignItems: 'center', padding: 12 },
});

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import type { JourneyInput } from '@/features/journeys/types';
import { colors } from '@/theme/colors';

export type JourneyFormValues = Omit<JourneyInput, 'cover_media_url'>;
type DateField = 'start_date' | 'end_date';

const toDate = (value: string) => new Date(`${value}T12:00:00`);
const toApiDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const displayDate = (value: string) => toDate(value).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

export function JourneyForm({ eyebrow, heading, submitLabel, initialValues, onSubmit, onCancel }: { eyebrow: string; heading: string; submitLabel: string; initialValues: JourneyFormValues; onSubmit: (values: JourneyFormValues) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState(initialValues);
  const [activeDate, setActiveDate] = useState<DateField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = (field: keyof JourneyFormValues) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  function changeDate(event: DateTimePickerEvent, date?: Date) {
    if (Platform.OS !== 'ios') setActiveDate(null);
    if (event.type === 'dismissed' || !date || !activeDate) return;
    setValues((current) => ({ ...current, [activeDate]: toApiDate(date) }));
  }

  async function submit() {
    const required = [values.title, values.destination, values.country];
    if (required.some((value) => !value.trim())) { setError('Add a title, destination, and country.'); return; }
    if (values.end_date < values.start_date) { setError('End date must be on or after the start date.'); return; }
    setError(null); setIsSubmitting(true);
    try {
      await onSubmit({ ...values, title: values.title.trim(), destination: values.destination.trim(), country: values.country.trim(), description: values.description?.trim() || null });
    } catch (caughtError) {
      setError(caughtError instanceof ApiError && caughtError.status === 0 ? caughtError.message : 'The journey could not be saved. Please try again.');
    } finally { setIsSubmitting(false); }
  }

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}><Pressable onPress={onCancel}><Text style={styles.cancel}>Cancel</Text></Pressable><Text style={styles.eyebrow}>{eyebrow}</Text><View style={styles.headerSpacer} /></View>
      <Text style={styles.heading}>{heading}</Text>
      <View style={styles.form}>
        <FormField label="Journey title" value={values.title} onChangeText={update('title')} placeholder="Medina 2025" />
        <FormField label="Destination" value={values.destination} onChangeText={update('destination')} placeholder="Medina" />
        <FormField label="Country" value={values.country} onChangeText={update('country')} placeholder="Saudi Arabia" />
        <View style={styles.dateRow}><DateButton label="Start date" value={values.start_date} onPress={() => setActiveDate('start_date')} /><DateButton label="End date" value={values.end_date} onPress={() => setActiveDate('end_date')} /></View>
        {activeDate ? <View style={styles.datePicker}><DateTimePicker value={toDate(values[activeDate])} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={changeDate} />{Platform.OS === 'ios' ? <Pressable onPress={() => setActiveDate(null)} style={styles.dateDone}><Text style={styles.dateDoneText}>Done</Text></Pressable> : null}</View> : null}
        <Text style={styles.label}>DESCRIPTION — OPTIONAL</Text><TextInput value={values.description ?? ''} onChangeText={update('description')} placeholder="What makes this journey special?" placeholderTextColor="#AAA79E" multiline textAlignVertical="top" style={styles.description} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={isSubmitting} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>{isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>{submitLabel}</Text>}</Pressable>
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  );
}

function FormField({ label, ...inputProps }: { label: string; value: string; placeholder: string; onChangeText: (value: string) => void }) { return <View style={styles.field}><Text style={styles.label}>{label.toUpperCase()}</Text><TextInput {...inputProps} placeholderTextColor="#AAA79E" autoCapitalize="words" style={styles.input} /></View>; }
function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.dateButton}><Text style={styles.label}>{label.toUpperCase()}</Text><Text style={styles.dateValue}>{displayDate(value)}</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: 22, paddingBottom: 40 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, cancel: { color: colors.accent, fontWeight: '700' }, eyebrow: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 }, headerSpacer: { width: 48 }, heading: { marginTop: 42, fontSize: 38, lineHeight: 42, fontWeight: '800', color: colors.ink, letterSpacing: -1.5, maxWidth: 340 }, form: { marginTop: 28 }, field: { borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 13 }, label: { color: colors.muted, fontSize: 9, letterSpacing: 1.5, fontWeight: '800' }, input: { paddingVertical: 8, fontSize: 20, color: colors.ink }, dateRow: { flexDirection: 'row', gap: 14, marginTop: 12 }, dateButton: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 14 }, dateValue: { color: colors.ink, fontSize: 15, marginTop: 9 }, datePicker: { backgroundColor: '#ECE8DE', borderRadius: 18, marginTop: 12, overflow: 'hidden' }, dateDone: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingBottom: 12 }, dateDoneText: { color: colors.accent, fontWeight: '800' }, description: { minHeight: 100, borderBottomWidth: 1, borderBottomColor: colors.line, paddingTop: 12, color: colors.ink, fontSize: 17, lineHeight: 23 }, error: { color: '#A33D2D', fontSize: 13, marginTop: 14 }, button: { marginTop: 28, backgroundColor: colors.ink, borderRadius: 18, height: 58, alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.86 }, disabled: { opacity: 0.65 } });

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';

import { JourneyLocationPicker } from '@/features/journeys/components/JourneyLocationPicker';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import type { JourneyInput } from '@/features/journeys/types';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates } from '@/utils/format';

export type JourneyFormValues = Omit<JourneyInput, 'cover_media_url'>;
type DateField = 'start_date' | 'end_date';

const toDate = (value: string) => new Date(`${value}T12:00:00`);
const toApiDate = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const displayDate = (value: string) => formatCalendarDate(value, { month: 'long', day: 'numeric', year: 'numeric' });

export function JourneyForm({ eyebrow, heading, submitLabel, initialValues, onSubmit, onCancel }: { eyebrow: string; heading: string; submitLabel: string; initialValues: JourneyFormValues; onSubmit: (values: JourneyFormValues) => Promise<void>; onCancel: () => void }) {
  const [values, setValues] = useState(initialValues);
  const [activeDate, setActiveDate] = useState<DateField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
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
      setError(caughtError instanceof ApiError ? caughtError.message : 'The journey could not be saved. Please try again.');
    } finally { setIsSubmitting(false); }
  }

  return (
    <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
      <SheetHeader title={eyebrow} onClose={onCancel} />
      <Text style={styles.heading}>{heading}</Text>
      <View style={styles.form}>
        <TextField label="Journey title" value={values.title} onChangeText={update('title')} placeholder="Medina 2025" autoCapitalize="words" />
        <TextField label="Destination" value={values.destination} onChangeText={update('destination')} placeholder="Medina" autoCapitalize="words" editable={!values.place} />
        <TextField label="Country" value={values.country} onChangeText={update('country')} placeholder="Saudi Arabia" autoCapitalize="words" editable={!values.place} />
        <Pressable accessibilityRole="button" accessibilityLabel="Search or choose journey place" onPress={() => setShowLocation(true)} style={styles.location}>
          <View style={styles.locationCopy}><Text style={styles.label}>LOCATION / PLACE — OPTIONAL</Text><Text numberOfLines={1} style={styles.locationValue}>{values.place?.display_name ?? formatCoordinates(values.latitude, values.longitude) ?? 'Search for a place or choose a map point'}</Text></View>
          <Text style={styles.locationAction}>{values.latitude ? 'Change' : 'Set'}</Text>
        </Pressable>
        <View style={styles.dateRow}><DateButton label="Start date" value={values.start_date} onPress={() => setActiveDate('start_date')} /><DateButton label="End date" value={values.end_date} onPress={() => setActiveDate('end_date')} /></View>
        {activeDate ? <View style={styles.datePicker}><DateTimePicker value={toDate(values[activeDate])} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={changeDate} />{Platform.OS === 'ios' ? <Pressable onPress={() => setActiveDate(null)} style={styles.dateDone}><Text style={styles.dateDoneText}>Done</Text></Pressable> : null}</View> : null}
        <TextField label="Description — optional" value={values.description ?? ''} onChangeText={update('description')} placeholder="What makes this journey special?" multiline contained />
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <PrimaryButton loading={isSubmitting} onPress={() => void submit()}>{submitLabel}</PrimaryButton>
      {showLocation ? <JourneyLocationPicker latitude={values.latitude} longitude={values.longitude} place={values.place ?? null} onCancel={() => setShowLocation(false)} onChange={(selection) => {
        setValues((current) => selection ? ({
          ...current,
          destination: selection.place?.name ?? current.destination,
          country: selection.place?.country ?? current.country,
          latitude: selection.coordinate.latitude.toFixed(6),
          longitude: selection.coordinate.longitude.toFixed(6),
          place: selection.place ?? current.place,
        }) : ({ ...current, latitude: null, longitude: null, place: current.place ? null : current.place }));
        setShowLocation(false);
      }} /> : null}
    </ScrollView></KeyboardAvoidingView></SafeAreaView>
  );
}

function DateButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) { return <Pressable onPress={onPress} style={styles.dateButton}><Text style={styles.label}>{label.toUpperCase()}</Text><Text style={styles.dateValue}>{displayDate(value)}</Text></Pressable>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.screen, paddingBottom: 40, gap: spacing.lg }, heading: { ...typography.display, color: colors.ink, marginTop: spacing.md, maxWidth: 340 }, form: { gap: spacing.md }, label: { ...typography.eyebrow, color: colors.muted, fontSize: 9, lineHeight: 13, letterSpacing: 1.5 }, dateRow: { flexDirection: 'row', gap: 14 }, dateButton: { flex: 1, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 14 }, dateValue: { ...typography.body, color: colors.ink, marginTop: 9 }, datePicker: { backgroundColor: colors.surfaceWarm, borderRadius: radii.lg, overflow: 'hidden' }, dateDone: { alignSelf: 'flex-end', paddingHorizontal: 18, paddingBottom: 12 }, dateDoneText: { color: colors.accent, fontWeight: '800' }, location: { minHeight: 70, borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, locationCopy: { flex: 1 }, locationValue: { ...typography.body, color: colors.ink, marginTop: spacing.xs }, locationAction: { ...typography.button, color: colors.accent, fontSize: 13 } });

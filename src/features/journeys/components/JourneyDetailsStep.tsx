import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { VideoCover } from '@/features/media/components/VideoCover';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Keyboard, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { JourneyInput } from '../types';
import type { DraftPhoto } from '../draft';
import { COUNTRIES } from '../countries';
import { JourneyVisibilityField } from './JourneyVisibilityField';
import type { ProfileTheme } from '@/features/profile/theme';
import { colors } from '@/theme/colors';
import { formatCalendarDate } from '@/utils/format';

export function JourneyDetailsStep({ values, cover, count, theme, onChange }: {
  values: JourneyInput; cover?: DraftPhoto; count: number; theme: ProfileTheme; onChange: (values: JourneyInput) => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [dateField, setDateField] = useState<'start_date' | 'end_date' | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [query, setQuery] = useState('');
  const update = (field: keyof JourneyInput, value: string) => onChange({ ...values, [field]: value });
  const card = [styles.card, { backgroundColor: theme.glassStrong }];
  return <>
    <View style={styles.coverRow}><View style={[styles.cover, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>{cover && !cover.unavailable ? cover.type === 'video' ? <VideoCover key={cover.uri} uri={cover.uri} time={cover.videoEdit?.coverTime ?? 0} /> : <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="images-outline" size={24} color={resolvePresentationColor(theme.muted, 'color', 'content')} />}</View><View><Text style={presentationTextStyle([styles.coverTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Journey cover</Text><Text style={presentationTextStyle([styles.hint, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{count} media selected</Text></View></View>
    <View style={card}>
      <Field label="Journey title" value={values.title} onChangeText={text => update('title', text)} placeholder="A weekend in Paris" maxLength={160} theme={theme} />
      <View style={[styles.divider, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />
      <Field label="Destination" value={values.destination} onChangeText={text => update('destination', text)} placeholder="Paris" maxLength={160} theme={theme} />
      <View style={[styles.divider, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Country, ${values.country || 'Choose country'}`} onPress={() => { Keyboard.dismiss(); setQuery(''); setCountryOpen(true); }} style={styles.row}><View style={styles.flex}><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Country</Text><Text style={presentationTextStyle([styles.value, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{values.country || 'Choose country'}</Text></View><Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /></Pressable>
    </View>
    <View style={[...card, styles.dates]}>{(['start_date', 'end_date'] as const).map(field => <Pressable accessibilityRole="button" key={field} onPress={() => { Keyboard.dismiss(); setDateField(current => current === field ? null : field); }} style={styles.date}><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{field === 'start_date' ? 'Start date' : 'End date'}</Text><Text style={presentationTextStyle([styles.value, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{formatCalendarDate(values[field], { month: 'short', day: 'numeric', year: 'numeric' })}</Text></Pressable>)}</View>
    {dateField ? <View style={card}><DateTimePicker value={new Date(`${values[dateField]}T12:00:00`)} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} themeVariant={theme.dark ? 'dark' : 'light'} onChange={(event, date) => {
      if (Platform.OS !== 'ios') setDateField(null);
      if (event.type !== 'dismissed' && date) update(dateField, `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
    }} /><Pressable accessibilityRole="button" onPress={() => setDateField(null)} style={styles.done}><Text style={presentationTextStyle(styles.blue)}>Done</Text></Pressable></View> : null}
    <View style={card}><Field label="Journey description · Optional" multiline value={values.description ?? ''} onChangeText={text => update('description', text)} placeholder="Tell the story of this journey…" theme={theme} /><Text style={presentationTextStyle([styles.hint, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>About the whole journey. Photo captions stay with each photo.</Text></View>
    <JourneyVisibilityField value={values.visibility ?? 'private'} onChange={visibility => update('visibility', visibility)} />
    <Modal visible={countryOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setCountryOpen(false)}><SafeAreaView style={[styles.flex, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }]}><View style={styles.modalHeader}><Text style={presentationTextStyle([styles.coverTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Country</Text><Pressable accessibilityRole="button" onPress={() => setCountryOpen(false)} style={styles.done}><Text style={presentationTextStyle(styles.blue)}>Done</Text></Pressable></View><TextInput keyboardAppearance={theme.dark ? 'dark' : 'light'} selectionColor={colors.accent} accessibilityLabel="Search countries" value={query} onChangeText={setQuery} placeholder="Search countries" placeholderTextColor={resolvePresentationColor(theme.subtle, 'placeholderTextColor', 'control')} style={presentationTextStyle([styles.search, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control'), color: resolvePresentationColor(theme.ink, 'color', 'control') }])} /><FlatList data={COUNTRIES.filter(country => country.name.toLowerCase().includes(query.trim().toLowerCase()))} keyExtractor={country => country.code} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { update('country', item.name); setCountryOpen(false); }} style={[styles.country, { borderColor: resolvePresentationColor(theme.divider, 'borderColor', 'control') }]}><Text style={presentationTextStyle([styles.value, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{item.name}</Text>{values.country === item.name ? <Ionicons name="checkmark" size={20} color={resolvePresentationColor(colors.accent, 'color', 'content')} /> : null}</Pressable>} /></SafeAreaView></Modal>
  </>;
}
function Field({ label, theme, multiline, ...props }: React.ComponentProps<typeof TextInput> & { label: string; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.field}><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{label}</Text><TextInput keyboardAppearance={theme.dark ? 'dark' : 'light'} selectionColor={colors.accent} accessibilityLabel={label} placeholderTextColor={resolvePresentationColor(theme.subtle, 'placeholderTextColor', 'control')} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={presentationTextStyle([styles.input, { color: resolvePresentationColor(theme.ink, 'color', 'control') }, multiline && styles.multiline])} {...props} /></View>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, coverRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 }, cover: { width: 60, height: 74, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, coverTitle: { fontSize: 16, fontWeight: '600' }, card: { borderRadius: 16, paddingHorizontal: 14 }, field: { paddingTop: 12, paddingBottom: 6 }, label: { fontSize: 12, fontWeight: '500' }, input: { minHeight: 38, fontSize: 16, paddingVertical: 7 }, multiline: { minHeight: 80, maxHeight: 160, lineHeight: 22 }, divider: { height: StyleSheet.hairlineWidth }, row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 10 }, value: { fontSize: 16, marginTop: 5 }, dates: { flexDirection: 'row' }, date: { flex: 1, minHeight: 72, justifyContent: 'center' }, hint: { fontSize: 12, lineHeight: 18, paddingBottom: 10, marginTop: 5 }, done: { minHeight: 44, paddingHorizontal: 14, alignItems: 'flex-end', justifyContent: 'center' }, blue: { color: colors.accent, fontSize: 16, fontWeight: '600' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingLeft: 20 }, search: { margin: 16, borderRadius: 12, padding: 12, fontSize: 16 }, country: { minHeight: 52, marginHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });
const presentationBaselineStyles = styles;

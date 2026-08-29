import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import type { Journey } from '@/features/journeys/types';
import { colors } from '@/theme/colors';

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function JourneyDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { journeys, fetchOne, remove } = useJourneys();
  const [journey, setJourney] = useState<Journey | null>(journeys.find((item) => item.id === id) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => { void fetchOne(id).then(setJourney).catch(() => setError(true)); }, [fetchOne, id]);
  useEffect(() => {
    const updatedJourney = journeys.find((item) => item.id === id);
    if (updatedJourney) setJourney(updatedJourney);
  }, [id, journeys]);
  function confirmDelete() { Alert.alert('Delete this journey?', 'This album and its future memories will be permanently removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void remove(id).then(() => router.replace('/')) }]); }

  if (!journey && !error) return <View style={styles.loading}><ActivityIndicator color={colors.accent} /></View>;
  if (!journey) return <SafeAreaView style={styles.loading}><Text style={styles.error}>This journey could not be opened.</Text><Pressable onPress={() => router.back()}><Text style={styles.action}>Go Back</Text></Pressable></SafeAreaView>;
  return <View style={styles.safe}><ScrollView showsVerticalScrollIndicator={false}>
    <View style={styles.cover}><View style={styles.sun} /><SafeAreaView style={styles.coverSafe} edges={['top']}><View style={styles.nav}><Pressable onPress={() => router.back()} style={styles.round}><Text style={styles.back}>‹</Text></Pressable><Pressable onPress={() => router.push({ pathname: '/journey/edit/[id]', params: { id } })} style={styles.edit}><Text style={styles.editText}>Edit</Text></Pressable></View><View><Text style={styles.country}>{journey.country.toUpperCase()}</Text><Text style={styles.title}>{journey.title}</Text><Text style={styles.destination}>{journey.destination} · {formatDate(journey.start_date)} — {formatDate(journey.end_date)}</Text></View></SafeAreaView></View>
    <View style={styles.body}>{journey.description ? <Text style={styles.description}>{journey.description}</Text> : <Text style={styles.muted}>No description yet.</Text>}<View style={styles.rule} /><Text style={styles.section}>Photos & Memories</Text><View style={styles.placeholder}><Text style={styles.placeholderTitle}>Your story begins here.</Text><Text style={styles.muted}>Photos, memories, and the day-by-day timeline will appear here in a future phase.</Text></View><Pressable onPress={confirmDelete} style={styles.delete}><Text style={styles.deleteText}>Delete Journey</Text></Pressable></View>
  </ScrollView></View>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 16 }, cover: { height: 470, backgroundColor: '#657063', overflow: 'hidden' }, sun: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#D4B57F', right: -40, top: 70, opacity: 0.75 }, coverSafe: { flex: 1, padding: 20, justifyContent: 'space-between' }, nav: { flexDirection: 'row', justifyContent: 'space-between' }, round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }, back: { color: colors.ink, fontSize: 34, lineHeight: 36 }, edit: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 21, paddingHorizontal: 18, justifyContent: 'center' }, editText: { color: colors.ink, fontWeight: '800' }, country: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 2 }, title: { color: '#FFF', fontSize: 48, lineHeight: 51, fontWeight: '800', letterSpacing: -1.8, marginTop: 7 }, destination: { color: 'rgba(255,255,255,0.84)', fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 14 }, body: { padding: 24, paddingBottom: 60 }, description: { color: colors.ink, fontSize: 20, lineHeight: 29 }, muted: { color: colors.muted, fontSize: 15, lineHeight: 22 }, rule: { height: 1, backgroundColor: colors.line, marginVertical: 28 }, section: { color: colors.ink, fontSize: 24, fontWeight: '800', letterSpacing: -0.7 }, placeholder: { backgroundColor: '#E8E3D8', borderRadius: 22, padding: 24, marginTop: 15 }, placeholderTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 8 }, delete: { alignSelf: 'center', marginTop: 42, padding: 12 }, deleteText: { color: '#A33D2D', fontWeight: '800' }, error: { color: colors.ink, fontSize: 18, fontWeight: '700' }, action: { color: colors.accent, fontWeight: '800' } });

import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { momentsApi, countryFlag } from '@/features/moments/api';
import { MomentGrid } from '@/features/moments/MomentGrid';
import type { MomentPlace } from '@/features/moments/types';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileTheme } from '@/features/profile/theme';
export default function MomentPlaceScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { id } = useLocalSearchParams<{ id: string }>(); const theme = useProfileTheme(); const { user } = useAuth(); const [data, setData] = useState<MomentPlace | null>(null); const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0);
  useEffect(() => { const controller = new AbortController(); setError(null); void momentsApi.place(id, controller.signal).then(value => { if (!controller.signal.aborted) setData(value); }).catch(failure => { if (!controller.signal.aborted) setError(failure.message); }); return () => controller.abort(); }, [id, retry]);
  const header = <View style={styles.header}>
    <Pressable accessibilityLabel="Back" onPress={() => router.back()} style={{ paddingVertical: 12 }}><Ionicons name="chevron-back" size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
    {data ? <><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{data.place.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{countryFlag(data.place.country_code)} {[data.place.locality, data.place.country].filter(Boolean).join(', ')}</Text><Pressable style={styles.map} onPress={() => router.push({ pathname: '/world/places', params: { worldMode: 'explore', latitude: data.place.latitude, longitude: data.place.longitude, focusPlaceName: data.place.name, focusRequest: String(Date.now()) } })}><Ionicons name="map-outline" size={20} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>View on map</Text></Pressable>
    {data.journeys.length ? <><Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Journeys from here</Text>{data.journeys.map(journey => <Pressable key={journey.id} style={{ paddingVertical: 12 }} onPress={() => router.push({ pathname: '/post/[id]', params: { id: journey.id, scope: journey.creator.id === user?.id ? 'own' : 'public' } })}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 16 })}>{journey.title} →</Text></Pressable>)}</> : null}<Text style={presentationTextStyle([styles.heading, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Windows into this place</Text></> : error ? <Pressable onPress={() => setRetry(value => value+1)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{error} · Retry</Text></Pressable> : <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} />}
  </View>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>{data ? <MomentGrid filter={{ place_id: id }} header={header} /> : header}</SafeAreaView>;
}
const styles = StyleSheet.create({ header: { paddingHorizontal: 24, paddingBottom: 20, gap: 12 }, title: { fontSize: 30, fontWeight: '600', letterSpacing: -0.8 }, heading: { fontSize: 19, fontWeight: '600', marginTop: 12 }, map: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15 } });
const presentationBaselineStyles = styles;

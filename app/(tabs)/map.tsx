import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useJourneys } from '@/features/journeys/JourneyProvider';
import { LoadingState } from '@/components/ui/Feedback';
import { mapApi } from '@/features/map/api';
import type { MapFilter, MapItem } from '@/features/map/types';
import { mappedItems } from '@/features/map/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, shadows, typography } from '@/theme/tokens';
import { formatCalendarDate, formatDateRange } from '@/utils/format';

const filters: { label: string; value: MapFilter }[] = [
  { label: 'All', value: 'all' }, { label: 'Journeys', value: 'journey' },
  { label: 'Memories', value: 'memory' }, { label: 'Photos', value: 'photo' },
];
const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#E8E5DC' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6E6A61' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F3F0E8' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F7F4ED' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#C8D5D2' }] },
];
const formatDate = (value: string | null) => value ? formatCalendarDate(value) : null;

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const { journeys } = useJourneys();
  const [items, setItems] = useState<MapItem[]>([]);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [selected, setSelected] = useState<MapItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const load = useCallback(async (active: () => boolean = () => true) => {
    setError(false);
    try { const result = await mapApi.list(); if (active()) setItems(result); }
    catch { if (active()) setError(true); }
    finally { if (active()) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { let active = true; setLoading(true); void load(() => active); return () => { active = false; }; }, [load]));
  const allMapped = useMemo(() => mappedItems(items, 'all'), [items]);
  const visible = useMemo(() => mappedItems(items, filter), [filter, items]);
  useEffect(() => {
    if (!mapReady || visible.length === 0) return;
    const timer = setTimeout(() => {
      if (visible.length === 1) mapRef.current?.animateToRegion({ ...visible[0].coordinate, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 450);
      else mapRef.current?.fitToCoordinates(visible.map((item) => item.coordinate), { edgePadding: { top: 155, right: 55, bottom: selected ? 275 : 100, left: 55 }, animated: true });
    }, 120);
    return () => clearTimeout(timer);
  }, [filter, mapReady, selected, visible]);
  const openSelected = () => {
    if (!selected) return;
    if (selected.type === 'photo') router.push(`/journey/${selected.journey_id}/photo/${selected.id}` as never);
    else if (selected.type === 'memory') router.push({ pathname: '/journey/[id]', params: { id: selected.journey_id, memoryId: selected.id } });
    else router.push({ pathname: '/journey/[id]', params: { id: selected.id } });
  };
  if (loading && items.length === 0) return <SafeAreaView style={styles.center}><LoadingState label="Gathering your places…" /></SafeAreaView>;
  if (!loading && allMapped.length === 0) return <SafeAreaView style={styles.empty}>
    <Text style={styles.eyebrow}>PLACES</Text><Text style={styles.emptyTitle}>Your world,{`\n`}remembered.</Text><View style={styles.orbit}><View style={styles.emptyPin}><Text style={styles.pinLetter}>V</Text></View></View>
    <Text style={styles.emptyCopy}>{error ? 'Your places could not be loaded.' : 'Add a location to a journey, memory, or photo and it will become part of your map.'}</Text>
    {error ? <Pressable onPress={() => { setLoading(true); void load(); }}><Text style={styles.retry}>Try Again</Text></Pressable> : null}
  </SafeAreaView>;
  return <View style={styles.screen}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} customMapStyle={mapStyle} rotateEnabled={false} onMapReady={() => setMapReady(true)} onPress={(event: MapPressEvent) => { if (event.nativeEvent.action !== 'marker-press') setSelected(null); }}>
      {visible.map((item) => <Marker accessibilityLabel={`${item.type}: ${item.title}`} key={`${item.type}:${item.id}`} coordinate={item.coordinate} onPress={() => setSelected(item)} tracksViewChanges={false}><View style={[styles.marker, item.type === 'journey' && styles.journeyMarker, item.type === 'memory' && styles.memoryMarker, item.type === 'photo' && styles.photoMarker, selected?.id === item.id && selected.type === item.type && styles.selectedMarker]}><Text style={[styles.markerText, item.type !== 'journey' && styles.subtleMarkerText]}>{item.type === 'journey' ? 'V' : item.type === 'memory' ? 'M' : 'P'}</Text></View></Marker>)}
    </MapView>
    <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={['top']}><View style={styles.header}><View><Text style={styles.eyebrow}>PLACES</Text><Text style={styles.mapTitle}>Your world</Text></View>{error ? <Pressable onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable> : null}</View>
      <View accessibilityRole="tablist" style={styles.filters}>{filters.map((option) => <Pressable accessibilityRole="tab" accessibilityState={{ selected: filter === option.value }} key={option.value} onPress={() => { setFilter(option.value); setSelected(null); }} style={[styles.filter, filter === option.value && styles.filterActive]}><Text style={[styles.filterText, filter === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}</View></SafeAreaView>
    {selected ? <SafeAreaView style={styles.cardWrap} edges={['bottom']} pointerEvents="box-none"><Pressable accessibilityRole="button" accessibilityLabel={`Open ${selected.type} ${selected.title}`} style={styles.card} onPress={openSelected}><View style={styles.thumbnail}>{selected.thumbnail_url ? <Image source={selected.thumbnail_url} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" /> : <Text style={styles.placeholder}>V</Text>}</View><View style={styles.cardBody}><Text style={styles.cardKind}>{selected.type.toUpperCase()}</Text><Text numberOfLines={1} style={styles.cardTitle}>{selected.title}</Text>{selected.caption ? <Text numberOfLines={2} style={styles.cardCaption}>{selected.caption}</Text> : null}<Text numberOfLines={1} style={styles.cardMeta}>{[selected.subtitle, selected.type === 'journey' ? (() => { const journey = journeys.find((entry) => entry.id === selected.id); return journey ? formatDateRange(journey.start_date, journey.end_date) : formatDate(selected.date); })() : formatDate(selected.date)].filter(Boolean).join(' · ')}</Text></View><Text accessibilityElementsHidden style={styles.chevron}>›</Text></Pressable></SafeAreaView> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, center: { flex: 1, backgroundColor: colors.canvas }, muted: { ...typography.body, color: colors.muted }, overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18 }, header: { marginTop: 8, padding: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(246,243,236,0.94)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { ...typography.eyebrow, color: colors.accent }, mapTitle: { ...typography.screenTitle, marginTop: 3, fontSize: 27, lineHeight: 31, color: colors.ink }, retry: { ...typography.button, color: colors.accent, padding: 8 }, filters: { alignSelf: 'center', marginTop: 9, padding: 4, borderRadius: radii.round, backgroundColor: 'rgba(246,243,236,0.94)', flexDirection: 'row', gap: 2 }, filter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, borderRadius: radii.round }, filterActive: { backgroundColor: colors.ink }, filterText: { ...typography.metadata, color: colors.muted }, filterTextActive: { color: colors.canvas },
  marker: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#F4EFE5', borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, journeyMarker: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, borderColor: '#F4EFE5', borderWidth: 3 }, memoryMarker: { backgroundColor: '#B75B3D', borderColor: '#F4EFE5' }, photoMarker: { backgroundColor: '#E7D8B7' }, selectedMarker: { transform: [{ scale: 1.15 }], borderColor: colors.accent }, markerText: { color: '#FFF', fontWeight: '900', fontSize: 16 }, subtleMarkerText: { fontSize: 10 },
  cardWrap: { position: 'absolute', left: 14, right: 14, bottom: 12 }, card: { minHeight: 122, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radii.lg, backgroundColor: '#F6F3EC', ...shadows.sheet }, thumbnail: { width: 96, height: 96, borderRadius: radii.md, overflow: 'hidden', backgroundColor: '#DED8CC', alignItems: 'center', justifyContent: 'center' }, placeholder: { color: colors.ink, fontSize: 24, fontWeight: '900' }, cardBody: { flex: 1, paddingHorizontal: 14 }, cardKind: { ...typography.eyebrow, color: colors.accent, fontSize: 9 }, cardTitle: { ...typography.cardTitle, marginTop: 4, color: colors.ink }, cardCaption: { ...typography.metadata, marginTop: 4, color: colors.ink, fontWeight: '400' }, cardMeta: { ...typography.metadata, marginTop: 6, color: colors.muted, fontSize: 11 }, chevron: { color: colors.muted, fontSize: 30, paddingRight: 4 },
  empty: { flex: 1, backgroundColor: colors.canvas, padding: 24, alignItems: 'center' }, emptyTitle: { alignSelf: 'flex-start', marginTop: 14, color: colors.ink, fontSize: 48, lineHeight: 49, fontWeight: '800', letterSpacing: -2 }, orbit: { marginTop: 72, width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, emptyPin: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, pinLetter: { color: colors.canvas, fontSize: 22, fontWeight: '900' }, emptyCopy: { marginTop: 44, maxWidth: 300, color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});

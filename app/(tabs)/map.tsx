import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/ui/Feedback';
import { mapApi } from '@/features/map/api';
import { MapMarkerView } from '@/features/map/components/MapMarkerView';
import { MapOverlapCard, MapSelectionCard } from '@/features/map/components/MapSelectionCard';
import type { MapFilter, MapItem, MapRegion } from '@/features/map/types';
import {
  clusterExpansionRegion,
  mapItemKey,
  mappedItems,
  prepareMapMarkers,
  selectedItemForFilter,
  type PreparedMapMarker,
} from '@/features/map/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

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
const worldRegion: MapRegion = { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 160 };

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);
  const hasFitted = useRef(false);
  const { width, height } = useWindowDimensions();
  const [items, setItems] = useState<MapItem[]>([]);
  const [filter, setFilter] = useState<MapFilter>('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [overlapItems, setOverlapItems] = useState<ReturnType<typeof mappedItems>>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string | null>>({});
  const [region, setRegion] = useState<MapRegion>(worldRegion);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  const load = useCallback(async (active: () => boolean = () => true) => {
    setError(false);
    try {
      const result = await mapApi.list();
      if (active()) setItems(result);
    } catch {
      if (active()) setError(true);
    } finally {
      if (active()) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    void load(() => active);
    return () => { active = false; };
  }, [load]));

  const allMapped = useMemo(() => mappedItems(items, 'all'), [items]);
  const filtered = useMemo(() => mappedItems(items, filter), [filter, items]);
  const selected = useMemo(
    () => selectedItemForFilter(selectedKey, filtered),
    [filtered, selectedKey],
  );
  const markers = useMemo(
    () => prepareMapMarkers(filtered, region, width, height),
    [filtered, height, region, width],
  );

  useEffect(() => {
    if (!selectedKey || selected) return;
    setSelectedKey(null);
  }, [selected, selectedKey]);

  useEffect(() => {
    if (!mapReady || hasFitted.current || allMapped.length === 0) return;
    hasFitted.current = true;
    const timer = setTimeout(() => {
      if (allMapped.length === 1) {
        mapRef.current?.animateToRegion({ ...allMapped[0].coordinate, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 450);
      } else {
        mapRef.current?.fitToCoordinates(allMapped.map((item) => item.coordinate), {
          edgePadding: { top: 155, right: 55, bottom: 105, left: 55 },
          animated: true,
        });
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [allMapped, mapReady]);

  useEffect(() => {
    if (!selected || selected.type === 'memory') return;
    const key = `${mapItemKey(selected)}:${selected.thumbnail_revision ?? 'none'}`;
    if (Object.hasOwn(thumbnails, key)) return;
    let active = true;
    void mapApi.thumbnail(selected.type, selected.id)
      .then(({ thumbnail_url }) => {
        if (active) setThumbnails((current) => ({ ...current, [key]: thumbnail_url }));
      })
      .catch(() => {
        if (active) setThumbnails((current) => ({ ...current, [key]: null }));
      });
    return () => { active = false; };
  }, [selected, thumbnails]);

  const selectItem = useCallback((item: ReturnType<typeof mappedItems>[number]) => {
    setOverlapItems([]);
    setSelectedKey(mapItemKey(item));
  }, []);

  const pressMarker = useCallback((marker: PreparedMapMarker) => {
    if (marker.kind === 'item') {
      selectItem(marker.item);
      return;
    }
    setSelectedKey(null);
    const expansion = clusterExpansionRegion(marker, region);
    if (expansion) {
      setOverlapItems([]);
      mapRef.current?.animateToRegion(expansion, 350);
    } else {
      setOverlapItems(marker.items);
    }
  }, [region, selectItem]);

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
    {error ? <Pressable accessibilityRole="button" onPress={() => { setLoading(true); void load(); }}><Text style={styles.retry}>Try Again</Text></Pressable> : null}
  </SafeAreaView>;

  return <View style={styles.screen}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      customMapStyle={mapStyle}
      initialRegion={worldRegion as Region}
      rotateEnabled={false}
      onMapReady={() => setMapReady(true)}
      onRegionChangeComplete={(next) => setRegion(next)}
      onPress={(event: MapPressEvent) => {
        if (event.nativeEvent.action !== 'marker-press') {
          setSelectedKey(null);
          setOverlapItems([]);
        }
      }}
    >
      {markers.map((marker) => <MapMarkerView
        key={marker.key}
        marker={marker}
        selected={marker.kind === 'item' && mapItemKey(marker.item) === selectedKey}
        onPress={pressMarker}
      />)}
    </MapView>
    <SafeAreaView pointerEvents="box-none" style={styles.overlay} edges={['top']}>
      <View style={styles.header}>
        <View><Text style={styles.eyebrow}>PLACES</Text><Text style={styles.mapTitle}>Your world</Text></View>
        <View style={styles.status}>
          {loading && items.length > 0 ? <Text style={styles.refreshing}>Refreshing…</Text> : null}
          {error ? <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={styles.retry}>Retry</Text></Pressable> : null}
        </View>
      </View>
      <View accessibilityRole="tablist" style={styles.filters}>{filters.map((option) => <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: filter === option.value }}
        key={option.value}
        onPress={() => {
          setFilter(option.value);
          setSelectedKey(null);
          setOverlapItems([]);
        }}
        style={[styles.filter, filter === option.value && styles.filterActive]}
      ><Text style={[styles.filterText, filter === option.value && styles.filterTextActive]}>{option.label}</Text></Pressable>)}</View>
      {filtered.length === 0 ? <View style={styles.filterEmpty}><Text style={styles.filterEmptyText}>No mapped {filter === 'all' ? 'items' : filter === 'memory' ? 'memories' : `${filter}s`} yet.</Text></View> : null}
    </SafeAreaView>
    {overlapItems.length > 0 ? <MapOverlapCard items={overlapItems} onSelect={selectItem} onClose={() => setOverlapItems([])} /> : null}
    {selected ? <MapSelectionCard
      item={selected}
      thumbnailUrl={thumbnails[`${mapItemKey(selected)}:${selected.thumbnail_revision ?? 'none'}`] ?? null}
      onOpen={openSelected}
    /> : null}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, center: { flex: 1, backgroundColor: colors.canvas },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 18 },
  header: { marginTop: 8, padding: spacing.md, borderRadius: radii.lg, backgroundColor: 'rgba(246,243,236,0.94)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  status: { alignItems: 'flex-end' }, refreshing: { ...typography.metadata, color: colors.muted },
  eyebrow: { ...typography.eyebrow, color: colors.accent }, mapTitle: { ...typography.screenTitle, marginTop: 3, fontSize: 27, lineHeight: 31, color: colors.ink },
  retry: { ...typography.button, color: colors.accent, padding: 8 },
  filters: { alignSelf: 'center', marginTop: 9, padding: 4, borderRadius: radii.round, backgroundColor: 'rgba(246,243,236,0.94)', flexDirection: 'row', gap: 2 },
  filter: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 11, borderRadius: radii.round },
  filterActive: { backgroundColor: colors.ink }, filterText: { ...typography.metadata, color: colors.muted }, filterTextActive: { color: colors.canvas },
  filterEmpty: { alignSelf: 'center', marginTop: spacing.sm, backgroundColor: 'rgba(246,243,236,0.94)', borderRadius: radii.round, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterEmptyText: { ...typography.metadata, color: colors.muted },
  empty: { flex: 1, backgroundColor: colors.canvas, padding: 24, alignItems: 'center' },
  emptyTitle: { alignSelf: 'flex-start', marginTop: 14, color: colors.ink, fontSize: 48, lineHeight: 49, fontWeight: '800', letterSpacing: -2 },
  orbit: { marginTop: 72, width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  emptyPin: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  pinLetter: { color: colors.canvas, fontSize: 22, fontWeight: '900' },
  emptyCopy: { marginTop: 44, maxWidth: 300, color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
});

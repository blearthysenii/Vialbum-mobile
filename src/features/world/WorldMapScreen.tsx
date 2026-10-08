import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import PersonalMomentsMap from '@/features/map/PersonalMomentsMap';
import type { MapRegion } from '@/features/map/types';
import { useProfileTheme } from '@/features/profile/theme';
import { useTabBarController } from '@/features/navigation/TabBarScrollContext';
import { worldStoreFor, worldPhotosFor } from './cache';
import type { WorldMarker, WorldMode, WorldPhoto } from './api';
import { groupPhotos, photoLevel, photoTarget, placeRegion } from './photos';
import { WorldPhotoMarker } from './WorldPhotoMarker';
import { expandCluster, fitBounds } from './viewport';
import { WorldMarkerView } from './WorldMarkerView';
import { WorldPlaceSheet } from './WorldPlaceSheet';

export function WorldMapScreen({ userId }: { userId: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const { expand } = useTabBarController();
  const params = useLocalSearchParams<{ worldMode?: string; latitude?: string; longitude?: string; focusRequest?: string; focusPlaceName?: string; filter?: string }>();
  const store = useMemo(() => worldStoreFor(userId), [userId]);
  const photos = useMemo(() => worldPhotosFor(userId), [userId]);
  const photoState = useSyncExternalStore(photos.subscribe, photos.getSnapshot, photos.getSnapshot);
  const [photoMode, setPhotoMode] = useState(false);
  const [focused, setFocused] = useState(false);
  const [photoSelection, setPhotoSelection] = useState<WorldPhoto[]>([]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const mapRef = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  const [momentFocus, setMomentFocus] = useState<{ latitude: number; longitude: number; title: string } | null>(null);
  const [selection, setSelection] = useState<WorldMarker | null>(null);
  const [moments, setMoments] = useState(Boolean(params.filter && !params.worldMode));
  const fitted = useRef(false);
  useEffect(() => { if (params.filter && !params.worldMode) setMoments(true); }, [params.filter, params.worldMode]);
  const camera = useCallback((region: MapRegion) => { store.setRegion(region, true); mapRef.current?.animateToRegion(region, reduceMotion ? 0 : 420); }, [reduceMotion, store]);
  useFocusEffect(useCallback(() => {
    setFocused(true);
    expand();
    if (!moments) void store.refresh();
    return () => { setFocused(false); store.suspend(); photos.suspend(); };
  }, [expand, moments, store, photos]));
  useEffect(() => { setPhotoMode(previous => state.mode === 'own' && photoLevel(state.region, previous)); }, [state.mode, state.region]);
  useEffect(() => {
    if (focused && photoMode && state.mode === 'own' && !moments) photos.load(state.region);
    else photos.suspend();
    return () => photos.suspend();
  }, [focused, photoMode, state.mode, state.region, moments, photos]);
  const photoGroups = useMemo(() => groupPhotos(photoState.items, state.region), [photoState.items, state.region]);
  useEffect(() => {
    if (!params.worldMode) return;
    const mode: WorldMode = params.worldMode === 'own' ? 'own' : 'explore';
    setMoments(false); setSelection(null); store.setMode(mode);
    const latitude = Number(params.latitude), longitude = Number(params.longitude);
    if (params.latitude && params.longitude && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      setMomentFocus(params.focusPlaceName ? { latitude, longitude, title: params.focusPlaceName } : null);
      fitted.current = mode === 'own';
      camera({ latitude, longitude, latitudeDelta: 0.12, longitudeDelta: 0.12 });
    }
    router.setParams({ worldMode: undefined, latitude: undefined, longitude: undefined, focusRequest: undefined, focusPlaceName: undefined, filter: undefined });
  }, [params.worldMode, params.latitude, params.longitude, params.focusRequest, params.focusPlaceName, camera, store]);
  useEffect(() => {
    if (!ready || state.mode !== 'own' || fitted.current || !state.data?.bounds) return;
    fitted.current = true;
    camera(fitBounds(state.data.bounds));
  }, [ready, state.mode, state.data?.bounds, camera]);
  const switchMode = (mode: WorldMode) => { setMomentFocus(null); setSelection(null); setPhotoSelection([]); store.setMode(mode); mapRef.current?.animateToRegion(store.getSnapshot().region, reduceMotion ? 0 : 350); };
  const pressMarker = useCallback((marker: WorldMarker) => {
    if (marker.type === 'cluster') {
      const region = expandCluster(marker, store.getSnapshot().region);
      if (region) { setSelection(null); camera(region); return; }
    }
    setSelection(marker);
    if (store.getSnapshot().mode === 'own' && marker.type === 'place') camera(placeRegion(marker));
  }, [camera, store]);
  const markers = useMemo(() => state.data?.items ?? [], [state.data?.items]);
  useEffect(() => { if (selection && selection.type === 'place' && !state.loading && !state.error && !markers.some(marker => marker.id === selection.id || (marker.type === 'cluster' && selection.latitude >= marker.bounds.south && selection.latitude <= marker.bounds.north && selection.longitude >= marker.bounds.west && selection.longitude <= marker.bounds.east))) setSelection(null); }, [markers, selection, state.loading, state.error]);
  if (moments) return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}><View style={{ paddingTop: insets.top }}><Pressable accessibilityRole="button" onPress={() => { router.setParams({ filter: undefined }); setMoments(false); setReady(false); store.setMode('own'); }} style={styles.link}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>‹ Your World</Text></Pressable></View><PersonalMomentsMap /></View>;
  return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>
    <MapView ref={mapRef} style={StyleSheet.absoluteFill} initialRegion={state.region} userInterfaceStyle={theme.dark ? 'dark' : 'light'} rotateEnabled={false} pitchEnabled={false} showsUserLocation={false}
      onMapReady={() => { setReady(true); mapRef.current?.animateToRegion(store.getSnapshot().region, 0); }}
      onRegionChangeComplete={region => store.setRegion(region)}
      onPress={event => { if (event.nativeEvent.action !== 'marker-press') setSelection(null); }}>
      {momentFocus ? <Marker coordinate={momentFocus} title={momentFocus.title} pinColor={theme.accent} /> : null}
      {(!photoMode || !photoState.items.length ? markers : markers.filter(marker => marker.id === selection?.id)).map(marker => <WorldMarkerView key={`${state.mode}:${theme.dark}:${marker.id}`} marker={marker} theme={theme} selected={selection?.id === marker.id} onPress={pressMarker} />)}
      {state.mode === 'own' && photoMode ? photoGroups.map(group => <WorldPhotoMarker key={`${group[0].id}:${group.length}:${theme.dark}`} photos={group} theme={theme} onPress={items => {
        if (items.length === 1) { router.push(photoTarget(items[0])); return; }
        if (state.region.longitudeDelta > 0.003) camera({ ...state.region, latitude: items[0].latitude, longitude: items[0].longitude, latitudeDelta: state.region.latitudeDelta / 2, longitudeDelta: state.region.longitudeDelta / 2 });
        else { setSelection(null); setPhotoSelection(items); }
      }} />) : null}
    </MapView>
    <View pointerEvents="box-none" style={[styles.overlay, { top: insets.top + 8 }]}>
      <View accessibilityRole="tablist" style={[styles.segment, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'content') }]}>{(['explore', 'own'] as const).map(mode => <Pressable key={mode} accessibilityRole="tab" accessibilityState={{ selected: state.mode === mode }} onPress={() => switchMode(mode)} style={[styles.segmentItem, state.mode === mode && { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontWeight: '600' })}>{mode === 'own' ? 'Your World' : 'Explore'}</Text></Pressable>)}</View>
      {state.mode === 'own' ? <View style={[styles.summary, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }]}><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Your World</Text>{state.data?.stats ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), lineHeight: 23 })}>{state.data.stats.countries} Countries · {state.data.stats.cities} Cities{'\n'}{state.data.stats.journeys} Journeys · {state.data.stats.places} Places</Text> : null}<Pressable accessibilityRole="button" onPress={() => { setSelection(null); setMoments(true); }} style={styles.link}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Memories & photos map</Text></Pressable></View> : null}
      {state.loading ? <ActivityIndicator style={[styles.status, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }]} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}
      {photoMode && photoState.loading ? <ActivityIndicator accessibilityLabel="Loading photos" style={styles.status} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}
      {photoMode && !photoState.loading && !photoState.error && !photoState.items.length ? <Text style={presentationTextStyle([styles.status, { color: resolvePresentationColor(theme.muted, 'color', 'content'), backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }])}>No photos with a location in this area.</Text> : null}
      {photoMode && photoState.error ? <Pressable style={[styles.status, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'control') }]} onPress={() => photos.load(state.region, true)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Couldn’t load photos · Retry</Text></Pressable> : null}
      {photoMode && photoState.truncated ? <Text style={presentationTextStyle([styles.status, { color: resolvePresentationColor(theme.ink, 'color', 'content'), backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }])}>Zoom in to see more photos.</Text> : null}
      {state.error ? <Pressable accessibilityRole="button" accessibilityLabel="Retry map loading" onPress={() => void store.refresh()} style={[styles.status, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Couldn’t refresh places · Retry</Text></Pressable> : null}
      {!state.loading && !state.error && !markers.length && !momentFocus ? <View style={[styles.status, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{state.mode === 'own' && state.data?.stats?.places === 0 ? 'Your world starts with your first journey.' : state.mode === 'own' ? 'No visited places in this area.' : 'No public journeys here yet'}</Text>{state.mode === 'own' && state.data?.stats?.journeys === 0 ? <Pressable accessibilityRole="button" onPress={() => router.push('/journey/new')} style={styles.link}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Create Journey</Text></Pressable> : null}</View> : null}
      {state.data?.truncated ? <View style={[styles.status, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Zoom in to see more places.</Text></View> : null}
    </View>
    {selection ? <WorldPlaceSheet key={`${userId}:${state.mode}:${selection.id}`} marker={selection} mode={state.mode} onClose={() => setSelection(null)} onSelect={pressMarker} onPhotos={() => { camera(placeRegion(selection)); setSelection(null); }} /> : null}
    {state.mode === 'own' && photoSelection.length ? <View style={{ position: 'absolute', bottom: insets.bottom + 85, left: 16, right: 16, padding: 16, borderRadius: 22, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}><Pressable onPress={() => setPhotoSelection([])} style={styles.link}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>Photos here · Close</Text></Pressable><ScrollView style={{ maxHeight: 220 }}>{photoSelection.map(photo => <Pressable key={photo.id} accessibilityRole="button" style={styles.link} onPress={() => router.push(photoTarget(photo))}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>{photo.display_name}</Text></Pressable>)}</ScrollView></View> : null}
  </View>;
}
const styles = StyleSheet.create({ overlay: { position: 'absolute', left: 16, right: 16 }, segment: { flexDirection: 'row', borderRadius: 22, padding: 4, borderWidth: StyleSheet.hairlineWidth, alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }, segmentItem: { minWidth: 122, minHeight: 44, paddingHorizontal: 17, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, summary: { alignSelf: 'flex-start', padding: 14, paddingBottom: 4, borderRadius: 22, marginTop: 12 }, title: { fontSize: 23, fontWeight: '600', letterSpacing: -0.6, marginBottom: 5 }, status: { alignSelf: 'center', padding: 12, borderRadius: 18, marginTop: 10 }, link: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'center' } });
const presentationBaselineStyles = styles;

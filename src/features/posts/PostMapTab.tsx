import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { StayPoint } from '@/features/stays/api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { placeApi } from '@/features/places/api';
import { cachedImageSource } from '@/features/media/imageUrl';
import { photoCoordinate } from '@/features/media/photoContext';
import type { PhotoOrigin } from '@/features/media/viewerGeometry';
import type { PublicPhoto } from '@/features/discover/types';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PostJourney } from './data';
import { cityFromResults, cityRegion, journeyCityQueries, type PostCity } from './cities';

function PhotoPreview({ photo, onOpen }: { photo: PublicPhoto; onOpen: (photo: PublicPhoto, origin?: PhotoOrigin) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const preview = useRef<View>(null);
  return <Pressable ref={preview} collapsable={false} accessibilityRole="button" accessibilityLabel={`Open ${photo.caption || photo.place?.name || 'photo'} in full screen`}
    onPress={() => preview.current?.measureInWindow((x, y, width, height) => onOpen(photo, { x, y, width, height, radius: 12 }))} style={styles.preview}>
    <Image source={cachedImageSource(photo.url, `public-photo:${photo.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" />
  </Pressable>;
}
export function PostMapTab({ journey, photos = journey.photos, theme, focusPhotoId, focusVersion, activePhotoId, onOpenPhoto, stayMarkers = [], stayFocus }: {
  journey: PostJourney; photos?: PublicPhoto[]; theme: ProfileTheme; focusPhotoId?: string; focusVersion?: number; activePhotoId?: string;
  stayMarkers?: StayPoint[]; stayFocus?: StayPoint;
  onOpenPhoto?: (photo: PublicPhoto, origin?: PhotoOrigin) => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const queries = useMemo(() => journeyCityQueries(journey), [journey]);
  const [cities, setCities] = useState<PostCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const map = useRef<MapView>(null);
  const reduceMotion = useReducedMotion();
  const locations = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; country: string; latitude: number; longitude: number; photos: PublicPhoto[] }>();
    photos.forEach(photo => {
      const point = photoCoordinate(photo);
      if (!point) return;
      const id = `photo:${point.latitude.toFixed(4)}:${point.longitude.toFixed(4)}`;
      const existing = grouped.get(id);
      if (existing) existing.photos.push(photo);
      else grouped.set(id, { id, ...point, name: photo.place?.name ?? 'Photo location', country: '', photos: [photo] });
    });
    return [...grouped.values()];
  }, [photos]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false); setCities([]);
    void (async () => {
      const found = new Map<string, PostCity>();
      let failed = false;
      for (const query of queries) {
        if (controller.signal.aborted) return;
        try {
          const city = cityFromResults(query, await placeApi.search(`${query.name}, ${query.country}`.slice(0, 100), controller.signal));
          if (city) found.set(city.id, city);
        } catch { failed = true; }
      }
      if (!controller.signal.aborted) { setCities([...found.values()]); setError(failed); setLoading(false); }
    })();
    return () => controller.abort();
  }, [queries, attempt]);
  useEffect(() => {
    if (!ready || !focusPhotoId) return;
    const location = locations.find(item => item.photos.some(photo => photo.id === focusPhotoId));
    if (!location) return;
    setSelected(location.id);
    map.current?.animateToRegion({ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }, reduceMotion ? 0 : 350);
  }, [focusPhotoId, focusVersion, locations, ready, reduceMotion]);
  useEffect(() => {
    const location = locations.find(item => item.photos.some(photo => photo.id === activePhotoId));
    if (location) setSelected(current => current ? location.id : current);
  }, [activePhotoId, locations]);
  useEffect(() => {
    if (!ready || !stayFocus) return;
    map.current?.animateToRegion({ ...stayFocus, latitudeDelta: .025, longitudeDelta: .025 }, reduceMotion ? 0 : 350);
  }, [stayFocus, focusVersion, ready, reduceMotion]);
  const stays = stayFocus && !stayMarkers.some(point => point.id === stayFocus.id) ? [...stayMarkers, stayFocus] : stayMarkers;
  const region = cityRegion([...cities, ...locations, ...stays.map(point => ({ ...point, country: '' }))]);
  const location = locations.find(item => item.id === selected);
  const city = cities.find(item => item.id === selected);
  const previewPhotos = location?.photos ?? (city ? photos.filter(photo => (photo.place?.locality || photo.place?.name || journey.place?.locality || journey.place?.name || journey.destination).toLocaleLowerCase() === city.name.toLocaleLowerCase()) : []);
  const previewIndex = Math.max(0, previewPhotos.findIndex(photo => photo.id === activePhotoId));
  if (loading && !locations.length && !stays.length) return <View style={styles.empty}><ActivityIndicator accessibilityLabel="Loading map" color={resolvePresentationColor(theme.muted, 'color', 'content')} /></View>;
  return <View>
    {region ? <>
      <View style={styles.map}><MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={region} onMapReady={() => setReady(true)} userInterfaceStyle={theme.dark ? 'dark' : 'light'} showsUserLocation={false} rotateEnabled={false} pitchEnabled={false}>
        {stays.map(item => <Marker key={`stay:${item.id}`} coordinate={item} title={item.name} description="Stay" zIndex={3}><View style={{ backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content'), borderRadius: 16, padding: 7 }}><Ionicons name="bed-outline" size={20} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></View></Marker>)}
        {cities.map(item => <Marker key={item.id} coordinate={item} title={item.name} pinColor={selected === item.id ? theme.accent : '#8B8B8B'} onPress={() => setSelected(item.id)} />)}
        {locations.map(item => <Marker key={item.id} coordinate={item} title={item.name} pinColor={selected === item.id ? theme.accent : '#8B8B8B'} zIndex={selected === item.id ? 2 : 1} onPress={() => setSelected(item.id)} />)}
      </MapView>
      {previewPhotos.length && onOpenPhoto ? <View style={styles.previews}>
        <FlatList key={`${selected}:${activePhotoId}`} horizontal showsHorizontalScrollIndicator={false} data={previewPhotos} keyExtractor={photo => photo.id} initialScrollIndex={previewIndex} getItemLayout={(_, index) => ({ length: 76, offset: 76 * index, index })} contentContainerStyle={styles.previewContent}
          renderItem={({ item }) => <PhotoPreview photo={item} onOpen={onOpenPhoto} />} />
      </View> : null}
      </View>
      {cities.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Focus ${item.name}`} onPress={() => { setSelected(item.id); map.current?.animateToRegion(cityRegion([item])!, reduceMotion ? 0 : 350); }} style={styles.row}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 15, fontWeight: '600' })}>{item.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 4 })}>{item.country}</Text></Pressable>)}
    </> : !error ? <View style={styles.empty}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>No location added</Text></View> : null}
    {error ? <Pressable accessibilityRole="button" style={styles.empty} onPress={() => setAttempt(value => value + 1)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Couldn’t load all locations · Retry</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({ map: { width: '100%', aspectRatio: 1, borderRadius: 22, overflow: 'hidden' }, empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 20 }, row: { minHeight: 64, paddingVertical: 14 }, previews: { position: 'absolute', bottom: 12, left: 0, right: 0 }, previewContent: { paddingHorizontal: 12 }, preview: { width: 68, height: 68, borderRadius: 12, overflow: 'hidden', marginRight: 8, backgroundColor: '#222222' } });
const presentationBaselineStyles = styles;

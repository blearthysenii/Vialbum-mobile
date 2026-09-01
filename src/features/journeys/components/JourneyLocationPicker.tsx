import { useEffect, useRef, useState } from 'react';
import { Keyboard, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ApiError } from '@/api/client';
import { PrimaryButton, QuietButton } from '@/components/ui/Button';
import { ErrorBanner, LoadingState } from '@/components/ui/Feedback';
import { BackButton } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import { placeApi } from '@/features/places/api';
import type { PlaceSelection } from '@/features/places/types';
import { canSearchPlaces, formatPlaceContext } from '@/features/places/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, shadows, typography } from '@/theme/tokens';

type Coordinate = { latitude: number; longitude: number };

export type JourneyLocationSelection = {
  coordinate: Coordinate;
  place: PlaceSelection | null;
};

type Props = {
  latitude: string | null;
  longitude: string | null;
  place: PlaceSelection | null;
  onCancel: () => void;
  onChange: (selection: JourneyLocationSelection | null) => void;
};

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#E8E3D8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5E5B53' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F1EA' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#BBC9C7' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#DED8CB' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F7F4ED' }] },
];

export function JourneyLocationPicker({ latitude, longitude, place, onCancel, onChange }: Props) {
  const existing = latitude !== null && longitude !== null
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
  const [selected, setSelected] = useState<Coordinate | null>(existing);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSelection | null>(place);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSelection[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const mapRef = useRef<MapView>(null);
  const requestRef = useRef(0);
  const initialRegion = selected
    ? { ...selected, latitudeDelta: 0.12, longitudeDelta: 0.12 }
    : { latitude: 20, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 };

  useEffect(() => {
    const normalized = query.trim();
    if (!canSearchPlaces(normalized)) {
      requestRef.current += 1;
      setResults([]);
      setSearchError(null);
      setHasSearched(false);
      setIsSearching(false);
      return;
    }
    const request = ++requestRef.current;
    const timer = setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
      void placeApi.search(normalized)
        .then((items) => {
          if (request !== requestRef.current) return;
          setResults(items);
          setHasSearched(true);
        })
        .catch((error) => {
          if (request !== requestRef.current) return;
          setResults([]);
          setHasSearched(true);
          setSearchError(error instanceof ApiError ? error.message : 'Place search is unavailable.');
        })
        .finally(() => {
          if (request === requestRef.current) setIsSearching(false);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [query, retryKey]);

  function selectMapPoint(event: MapPressEvent) {
    setSelected(event.nativeEvent.coordinate);
    Keyboard.dismiss();
  }

  function selectPlace(result: PlaceSelection) {
    const coordinate = { latitude: Number(result.latitude), longitude: Number(result.longitude) };
    setSelected(coordinate);
    setSelectedPlace(result);
    setQuery('');
    setResults([]);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion({ ...coordinate, latitudeDelta: 0.12, longitudeDelta: 0.12 }, 400);
  }

  return <Modal animationType="slide" onRequestClose={onCancel}>
    <View style={styles.screen}>
      <MapView ref={mapRef} customMapStyle={mapStyle} initialRegion={initialRegion} onPress={selectMapPoint} rotateEnabled={false} style={StyleSheet.absoluteFill}>
        {selected ? <Marker coordinate={selected}><View style={styles.marker}><Text style={styles.markerText}>V</Text></View></Marker> : null}
      </MapView>
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.top} pointerEvents="box-none">
          <View style={styles.header}>
            <BackButton onPress={onCancel} />
            <View style={styles.copy}><Text style={styles.eyebrow}>JOURNEY PLACE</Text><Text style={styles.title}>Find a place, then fine-tune it.</Text></View>
          </View>
          <View style={styles.searchPanel}>
            <TextField label="Search places" value={query} onChangeText={setQuery} placeholder="Medina, Milan, Istanbul…" autoCapitalize="words" returnKeyType="search" contained />
            {isSearching ? <LoadingState label="Searching places…" /> : null}
            {searchError ? <ErrorBanner message={searchError} onRetry={() => setRetryKey((value) => value + 1)} /> : null}
            {!isSearching && !searchError && hasSearched && results.length === 0 ? <Text style={styles.empty}>No matching places. Try adding a country or region.</Text> : null}
            {results.length > 0 ? <ScrollView keyboardShouldPersistTaps="handled" style={styles.results}>
              {results.map((result) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${result.display_name}`} key={`${result.provider}:${result.provider_place_id}`} onPress={() => selectPlace(result)} style={styles.result}>
                <Text numberOfLines={1} style={styles.resultName}>{result.name}</Text>
                <Text numberOfLines={2} style={styles.resultContext}>{formatPlaceContext(result)}</Text>
              </Pressable>)}
            </ScrollView> : null}
            <Text accessibilityRole="link" onPress={() => void Linking.openURL('https://www.geoapify.com/')} style={styles.attribution}>Powered by Geoapify</Text>
          </View>
        </View>
        <View style={styles.sheet}>
          {selectedPlace ? <View style={styles.selectedPlace}><Text style={styles.selectedName}>{selectedPlace.name}</Text><Text style={styles.selectedContext}>{formatPlaceContext(selectedPlace)}</Text></View> : null}
          <Text style={styles.coordinates}>{selected ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : 'Search above or tap the map to choose a custom point.'}</Text>
          <View style={styles.actions}>
            {(selected || existing || place) ? <QuietButton onPress={() => onChange(null)}>Clear</QuietButton> : null}
            <PrimaryButton disabled={!selected} onPress={() => selected && onChange({ coordinate: selected, place: selectedPlace })} style={styles.save}>Use This Place</PrimaryButton>
          </View>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, chrome: { flex: 1, justifyContent: 'space-between', padding: spacing.md },
  top: { gap: spacing.sm }, header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { backgroundColor: 'rgba(244,241,234,0.96)', borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexShrink: 1 },
  eyebrow: { ...typography.eyebrow, color: colors.accent, fontSize: 9 }, title: { ...typography.button, color: colors.ink, marginTop: 3 },
  searchPanel: { backgroundColor: colors.canvas, borderRadius: radii.lg, padding: spacing.md, ...shadows.sheet },
  results: { maxHeight: 230, marginTop: spacing.sm }, result: { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: spacing.sm },
  resultName: { ...typography.button, color: colors.ink }, resultContext: { ...typography.metadata, color: colors.muted, marginTop: 2 },
  empty: { ...typography.body, color: colors.muted, paddingVertical: spacing.md, textAlign: 'center' },
  attribution: { ...typography.metadata, color: colors.subtle, textAlign: 'right', marginTop: spacing.sm, textDecorationLine: 'underline' },
  sheet: { backgroundColor: colors.canvas, borderRadius: radii.lg, padding: spacing.md, ...shadows.sheet },
  selectedPlace: { alignItems: 'center', marginBottom: spacing.sm }, selectedName: { ...typography.cardTitle, color: colors.ink },
  selectedContext: { ...typography.metadata, color: colors.muted, marginTop: 2, textAlign: 'center' },
  coordinates: { ...typography.metadata, color: colors.muted, textAlign: 'center', marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm }, save: { flex: 1 },
  marker: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  markerText: { color: colors.onDark, fontWeight: '900' },
});

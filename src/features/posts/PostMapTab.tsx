import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useReducedMotion } from 'react-native-reanimated';
import { placeApi } from '@/features/places/api';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PostJourney } from './data';
import { cityFromResults, cityRegion, journeyCityQueries, type PostCity } from './cities';

export function PostMapTab({ journey, theme }: { journey: PostJourney; theme: ProfileTheme }) {
  const queries = useMemo(() => journeyCityQueries(journey), [journey]);
  const [cities, setCities] = useState<PostCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const map = useRef<MapView>(null);
  const reduceMotion = useReducedMotion();
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
  const region = cityRegion(cities);
  if (loading) return <View style={styles.empty}><ActivityIndicator accessibilityLabel="Loading map" color={theme.muted} /></View>;
  return <View>
    {region ? <>
      <View style={styles.map}><MapView ref={map} style={StyleSheet.absoluteFill} initialRegion={region} userInterfaceStyle={theme.dark ? 'dark' : 'light'} showsUserLocation={false} rotateEnabled={false} pitchEnabled={false}>
        {cities.map(city => <Marker key={city.id} coordinate={{ latitude: city.latitude, longitude: city.longitude }} title={city.name} description={city.country} />)}
      </MapView></View>
      {cities.map(city => <Pressable key={city.id} accessibilityRole="button" accessibilityLabel={`Focus ${city.name}`} onPress={() => map.current?.animateToRegion(cityRegion([city])!, reduceMotion ? 0 : 350)} style={[styles.row, { borderColor: theme.divider }]}><Text style={{ color: theme.ink, fontSize: 15, fontWeight: '600' }}>{city.name}</Text><Text style={{ color: theme.muted, marginTop: 4 }}>{city.country}</Text></Pressable>)}
    </> : !error ? <View style={styles.empty}><Text style={{ color: theme.muted }}>No location added</Text></View> : null}
    {error ? <Pressable accessibilityRole="button" style={styles.empty} onPress={() => setAttempt(value => value + 1)}><Text style={{ color: theme.muted }}>Couldn’t load all locations · Retry</Text></Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({ map: { width: '100%', aspectRatio: 1, borderRadius: 22, overflow: 'hidden' }, empty: { minHeight: 180, alignItems: 'center', justifyContent: 'center', padding: 20 }, row: { minHeight: 64, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth } });

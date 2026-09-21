import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { exploreApi, type PlaceResults } from '@/features/explore/api';
import { cachedImageSource } from '@/features/media/imageUrl';
import { useProfileTheme } from '@/features/profile/theme';
import { formatDateRange } from '@/utils/format';
import { worldApi, type OwnPlace, type WorldMarker, type WorldMode } from './api';

export function WorldPlaceSheet({ marker, mode, onClose, onSelect, onPhotos }: { marker: WorldMarker; mode: WorldMode; onClose: () => void; onSelect: (marker: WorldMarker) => void; onPhotos: () => void }) {
  const theme = useProfileTheme();
  const insets = useSafeAreaInsets();
  const [own, setOwn] = useState<OwnPlace | null>(null);
  const [publicPlace, setPublicPlace] = useState<PlaceResults | null>(null);
  const [members, setMembers] = useState<WorldMarker[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const retryCursor = useRef<string | null>(null);
  const load = useCallback(async (after: string | null = null) => {
    if (busy.current) return;
    busy.current = true; retryCursor.current = after;
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(false);
    try {
      if (marker.type === 'cluster') {
        const result = await worldApi.members(mode, marker.bounds, after, controller.signal);
        if (!controller.signal.aborted) { setMembers(previous => [...new Map([...(after ? previous : []), ...result.items].map(item => [item.id, item])).values()]); setCursor(result.next_cursor); }
      } else if (mode === 'own') {
        const result = await worldApi.place(marker.place_id!, after, controller.signal);
        if (!controller.signal.aborted) { setOwn(previous => ({ ...result, journeys: after ? [...(previous?.journeys ?? []), ...result.journeys] : result.journeys })); setCursor(result.next_cursor); }
      } else {
        const result = await exploreApi.place(marker.place_id!, null, controller.signal);
        if (!controller.signal.aborted) setPublicPlace(result);
      }
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) { busy.current = false; setLoading(false); } }
  }, [marker, mode]);
  useEffect(() => { void load(); return () => { request.current?.abort(); busy.current = false; }; }, [load]);
  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8, onPanResponderRelease: (_, gesture) => { if (gesture.dy > 35) onClose(); } }), [onClose]);
  const cover = own?.journeys[0]?.cover_url ?? publicPlace?.journeys.items[0]?.cover_media_url;
  const title = own?.name ?? publicPlace?.place.name ?? marker.name ?? 'Places here';
  const subtitle = own ? [own.locality, own.country].filter(Boolean).join(', ') : publicPlace ? [publicPlace.place.region, publicPlace.place.country].filter(Boolean).join(', ') : marker.country;
  return <View style={[styles.sheet, { bottom: insets.bottom + 82, backgroundColor: theme.canvas, borderColor: theme.border }]}>
    <View {...pan.panHandlers} style={styles.handleArea}><View style={[styles.handle, { backgroundColor: theme.subtle }]} /></View>
    <View style={styles.heading}><View style={{ flex: 1 }}><Text style={[styles.title, { color: theme.ink }]}>{title}</Text>{subtitle ? <Text style={{ color: theme.muted, marginTop: 4 }}>{subtitle}</Text> : null}</View><Pressable accessibilityLabel="Close place preview" accessibilityRole="button" onPress={onClose} style={styles.close}><Text style={{ fontSize: 28, color: theme.muted }}>×</Text></Pressable></View>
    {loading && !own && !publicPlace && !members.length ? <ActivityIndicator style={{ margin: 18 }} color={theme.muted} /> : null}
    <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
      {own ? <><Text style={{ color: theme.muted }}>{(own as OwnPlace & { photo_count: number }).photo_count} Photos · {own.journey_count} Journeys</Text><Pressable accessibilityRole="button" style={styles.row} onPress={onPhotos}><Text style={{ color: theme.accent }}>View Photos</Text></Pressable></> : null}
      {cover ? <Image source={cachedImageSource(cover, `world:${marker.place_id}`)} style={styles.cover} contentFit="cover" /> : null}
      {publicPlace ? <><Text style={{ color: theme.muted, marginVertical: 10 }}>{publicPlace.place.public_journeys_count} public journeys</Text><Pressable accessibilityRole="button" accessibilityLabel={`View ${title}`} style={[styles.button, { backgroundColor: theme.ink }]} onPress={() => router.push(`/explore/place/${marker.place_id}`)}><Text style={{ color: theme.canvas, fontWeight: '600' }}>View Place</Text></Pressable></> : null}
      {own ? <><Text style={{ color: theme.muted, marginVertical: 10 }}>Visited in · {own.journey_count} journeys</Text>{own.journeys.map(journey => <Pressable key={journey.id} style={styles.row} accessibilityRole="button" onPress={() => router.push({ pathname: '/post/[id]', params: { id: journey.id, scope: 'own' } })}><Text style={{ color: theme.ink, fontWeight: '600' }}>{journey.title}</Text><Text style={{ color: theme.muted, marginTop: 4 }}>{formatDateRange(journey.start_date, journey.end_date)}</Text></Pressable>)}</> : null}
      {members.map(item => <Pressable key={item.id} style={styles.row} accessibilityRole="button" onPress={() => onSelect(item)}><Text style={{ color: theme.ink, fontWeight: '600' }}>{item.name}</Text><Text style={{ color: theme.muted }}>{item.country} · {item.journey_count} journeys</Text></Pressable>)}
      {marker.type === 'cluster' && !members.length && !loading && !error ? <Text style={{ color: theme.muted }}>No places available here now.</Text> : null}
      {cursor && !error ? <Pressable accessibilityRole="button" disabled={loading} style={styles.row} onPress={() => void load(cursor)}><Text style={{ color: theme.accent }}>{loading ? 'Loading…' : 'Show more'}</Text></Pressable> : null}
      {error ? <Pressable accessibilityRole="button" style={styles.row} onPress={() => void load(retryCursor.current)}><Text accessibilityRole="alert" style={{ color: theme.danger }}>This place could not be loaded. Retry</Text></Pressable> : null}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ sheet: { position: 'absolute', left: 14, right: 14, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingBottom: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 5 }, elevation: 5 }, handleArea: { height: 30, alignItems: 'center', justifyContent: 'center' }, handle: { width: 34, height: 4, borderRadius: 2 }, heading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 }, title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, cover: { height: 95, borderRadius: 16 }, row: { paddingVertical: 13, minHeight: 44 }, button: { borderRadius: 18, padding: 14, alignItems: 'center', minHeight: 46 } });

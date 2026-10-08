import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiscoverJourneyCard } from '@/features/discover/components/DiscoverJourneyCard';
import { cachedImageSource } from '@/features/media/imageUrl';
import { useProfileTheme } from '@/features/profile/theme';
import { GlassButton } from '@/features/stays/StayGlass';
import { worldMapTarget } from '@/features/world/viewport';
import { exploreApi, type DestinationResults, type DestinationTab, type PublicPlace } from './api';
import { MomentPreviews, SearchSkeleton, StayResults } from './DiscoveryContent';
const tabs: DestinationTab[] = ['overview', 'journeys', 'stays', 'moments'];
export function PlaceExploreScreen({ id }: { id: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const [tab, setTab] = useState<DestinationTab>('overview'), [data, setData] = useState<DestinationResults>(), [place, setPlace] = useState<PublicPlace>(), [loading, setLoading] = useState(false), [more, setMore] = useState(false), [error, setError] = useState<string>();
  const request = useRef<AbortController | null>(null), locked = useRef(false);
  const load = useCallback(async (cursor: string | null = null) => {
    if (cursor && locked.current) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller; locked.current = true;
    setError(undefined); if (cursor) setMore(true); else setLoading(true);
    try {
      const result = await exploreApi.destination(id, tab, cursor, controller.signal);
      if (controller.signal.aborted) return;
      setPlace(previous => ({ ...result.place, cover_url: result.place.cover_url || previous?.cover_url }));
      setData(previous => {
        if (!cursor || !previous || tab === 'overview') return result;
        return { ...result, [tab]: { ...result[tab], items: [...new Map([...previous[tab].items, ...result[tab].items].map(item => [item.id, item])).values()] } };
      });
    } catch { if (!controller.signal.aborted) { setError('Destination could not be loaded. Please retry.'); if (!cursor) { setData(undefined); setPlace(undefined); } } }
    finally { if (!controller.signal.aborted) { locked.current = false; setLoading(false); setMore(false); } }
  }, [id, tab]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current?.abort(); locked.current = false; }; }, [load]));
  const latitude = Number(place?.latitude), longitude = Number(place?.longitude);
  const map = place && Number.isFinite(latitude) && Number.isFinite(longitude) ? () => router.push(worldMapTarget('explore', latitude, longitude)) : undefined;
  const journeys = data?.journeys.items ?? [], stays = data?.stays.items ?? [], moments = data?.moments.items ?? [];
  const empty = tab !== 'overview' ? !data?.[tab].items.length : !journeys.length && !stays.length && !moments.length;
  const next = tab === 'overview' ? null : data?.[tab].next_cursor;
  return <SafeAreaView style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 36 }}>
      <View style={[styles.hero, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'content'), minHeight: place?.cover_url ? 320 : 180 }]}>{place?.cover_url ? <><Image source={cachedImageSource(place.cover_url, `destination:${id}`)} style={StyleSheet.absoluteFill} cachePolicy="memory-disk" contentFit="cover" /><LinearGradient colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,.75)'], 'colors', 'content')} pointerEvents="none" style={styles.gradient} /></> : null}<View style={styles.back}><GlassButton label="Back" theme={theme} media={Boolean(place?.cover_url)} radius={22} onPress={() => router.back()} style={styles.circle}><Ionicons name="chevron-back" size={22} color={resolvePresentationColor(place?.cover_url ? '#fff' : theme.ink, 'color', 'content')} /></GlassButton></View>{place ? <View style={styles.identity}><Text style={presentationTextStyle({ color: resolvePresentationColor(place.cover_url ? '#fff' : theme.ink, 'color', 'content'), fontSize: 32, fontWeight: '700', letterSpacing: -.6 })}>{place.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(place.cover_url ? '#eee' : theme.muted, 'color', 'content'), fontSize: 16, marginTop: 6 })}>{place.country}</Text></View> : null}</View>
      <View style={styles.content}>{map ? <GlassButton label="View destination on map" theme={theme} accent onPress={map} style={styles.map}><Ionicons name="map-outline" size={18} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontWeight: '600' })}>Map</Text></GlassButton> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>{tabs.map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: value === tab }} onPress={() => setTab(value)} style={[styles.tab, value === tab && { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(value === tab ? theme.ink : theme.muted, 'color', 'content'), fontWeight: value === tab ? '600' : '400' })}>{value[0].toUpperCase() + value.slice(1)}</Text></Pressable>)}</ScrollView>
      {loading ? <SearchSkeleton theme={theme} /> : <>{error ? <View style={styles.error}><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={styles.tab}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Retry</Text></Pressable></View> : null}
      {(tab === 'overview' || tab === 'journeys') && journeys.length ? <><View style={styles.heading}><Text style={presentationTextStyle([styles.section, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Recent journeys</Text>{tab === 'overview' ? <Pressable style={styles.tab} onPress={() => setTab('journeys')}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>See all</Text></Pressable> : null}</View><View style={styles.grid}>{journeys.map(journey => <View key={journey.id} style={{ width: '50%' }}><DiscoverJourneyCard journey={journey} theme={theme} onOpen={journeyId => router.push({ pathname: '/post/[id]', params: { id: journeyId, scope: 'public' } })} /></View>)}</View></> : null}
      {(tab === 'overview' || tab === 'stays') && stays.length ? <><View style={styles.heading}><Text style={presentationTextStyle([styles.section, { color: resolvePresentationColor(theme.ink, 'color', 'content'), flex: 1 }])}>Where travelers stayed in {place?.name}</Text>{tab === 'overview' ? <Pressable style={styles.tab} onPress={() => setTab('stays')}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>See all</Text></Pressable> : null}</View><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginBottom: 18 })}>Real stays from Vialbum travelers.</Text><StayResults items={stays} theme={theme} /></> : null}
      {(tab === 'overview' || tab === 'moments') && moments.length ? <><View style={styles.heading}><Text style={presentationTextStyle([styles.section, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Recent Moments</Text>{tab === 'overview' ? <Pressable style={styles.tab} onPress={() => setTab('moments')}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>See all</Text></Pressable> : null}</View><MomentPreviews items={moments} theme={theme} /></> : null}
      {!error && empty ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), lineHeight: 22, paddingVertical: 28 })}>{tab === 'overview' ? 'No public traveler content here yet.' : `No public ${tab === 'moments' ? 'Moments' : tab} here yet.`}</Text> : null}
      {next && !error ? <Pressable accessibilityRole="button" disabled={more} style={styles.tab} onPress={() => void load(next)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>{more ? 'Loading…' : 'Load more'}</Text></Pressable> : null}</>}
      <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.subtle, 'color', 'content'), fontSize: 11, marginTop: 28 })}>Place data © Geoapify / OpenStreetMap contributors</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ hero: { overflow: 'hidden', justifyContent: 'flex-end' }, gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' }, back: { position: 'absolute', top: 14, left: 22 }, circle: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }, identity: { padding: 22 }, content: { paddingHorizontal: 22 }, map: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, marginTop: 18 }, tabs: { gap: 4, marginTop: 18 }, tab: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 22 }, heading: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between', marginTop: 22, marginBottom: 14 }, section: { fontSize: 21, fontWeight: '600' }, grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', marginHorizontal: -5 }, error: { paddingVertical: 22 } });
const presentationBaselineStyles = styles;

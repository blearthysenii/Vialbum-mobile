import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, PanResponder, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTabBarController } from '@/features/navigation/TabBarScrollContext';
import { useProfileTheme } from '@/features/profile/theme';
import { cachedImageSource } from '@/features/media/imageUrl';
import { countLabel, countryFlag, travelApi, type TravelProgress } from './api';
import { PassportMap } from './PassportMap';

export function MyWorldScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme(), insets = useSafeAreaInsets(), reducedMotion = useReducedMotion();
  const { expand } = useTabBarController();
  const [data, setData] = useState<TravelProgress | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [mode, setMode] = useState<'countries' | 'continents'>('countries');
  const [selectedContinent, setSelectedContinent] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const indicator = useRef(new Animated.Value(0)).current;
  const [segmentWidth, setSegmentWidth] = useState(0);
  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(false);
    try { const result = await travelApi.progress(controller.signal); if (!controller.signal.aborted) setData(result); }
    catch { if (!controller.signal.aborted) setError(true); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { expand(); void load(); return () => { request.current?.abort(); setSelected(null); }; }, [expand, load]));
  useEffect(() => {
    Animated.timing(indicator, { toValue: mode === 'countries' ? 0 : 1, duration: reducedMotion ? 0 : 220, useNativeDriver: true }).start();
  }, [indicator, mode, reducedMotion]);
  const visited = useMemo(() => new Set(data?.countries.map(c => c.code) ?? []), [data]);
  const activeContinents = useMemo(() => new Set(data?.countries.map(c => c.continent) ?? []), [data]);
  const countries = useMemo(() => new Map(data?.countries.map(c => [c.code, c]) ?? []), [data]);
  const country = selected ? countries.get(selected.code) : null;
  const openCountry = (code: string) => { setSelected(null); router.push({ pathname: '/world/country', params: { code } }); };
  const dismiss = useCallback(() => setSelected(null), []);
  const pan = useMemo(() => PanResponder.create({ onMoveShouldSetPanResponder: (_, g) => g.dy > 8, onPanResponderRelease: (_, g) => { if (g.dy > 35) dismiss(); } }), [dismiss]);
  const surface = theme.dark ? '#1C1C20' : '#F5F5F7';
  const stats = data?.stats;
  return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }} refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => void load()} tintColor={resolvePresentationColor(theme.accent, 'tintColor', 'content')} />}>
      <View style={styles.header}>
        <Text style={presentationTextStyle([styles.eyebrow, { color: resolvePresentationColor(theme.muted, 'color', 'surface') }])}>YOUR TRAVEL PASSPORT</Text>
        <View style={styles.row}><Text accessibilityRole="header" style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>My World</Text><Pressable accessibilityRole="button" accessibilityLabel="Open existing places and photos map" onPress={() => router.push('/world/places')} style={[styles.icon, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'control') }]}><Ionicons name="map-outline" size={21} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable></View>
        <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 16, marginTop: 6 })}>{stats ? `${countLabel(stats.countries, 'country')} · ${countLabel(stats.continents, 'continent')}` : 'Your journeys, around the world'}</Text>
      </View>
      <View style={[styles.segment, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'surface') }]} onLayout={event => setSegmentWidth((event.nativeEvent.layout.width - 8) / 2)} accessibilityRole="tablist">
        <Animated.View pointerEvents="none" style={[styles.indicator, { width: segmentWidth, backgroundColor: resolvePresentationColor(theme.dark ? '#3A3A40' : '#FFFFFF', 'backgroundColor', 'control'), transform: [{ translateX: indicator.interpolate({ inputRange: [0, 1], outputRange: [0, segmentWidth] }) }] }]} />
        {(['countries', 'continents'] as const).map(value => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { setMode(value); setSelectedContinent(null); }} style={styles.segmentItem}><Text style={presentationTextStyle({ color: resolvePresentationColor(mode === value ? theme.ink : theme.muted, 'color', 'content'), fontWeight: '600', fontSize: 14 })}>{value === 'countries' ? 'Countries' : 'Continents'}</Text></Pressable>)}
      </View>
      {error ? <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.notice}><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content') })}>{data ? 'Couldn’t refresh your world. Tap to retry.' : 'Couldn’t load your world. Tap to retry.'}</Text></Pressable> : null}
      {loading && !data ? <ActivityIndicator accessibilityLabel="Loading your world" color={resolvePresentationColor(theme.accent, 'color', 'content')} style={{ margin: 28 }} /> : null}
      <View style={styles.map}><PassportMap theme={theme} visited={visited} activeContinents={activeContinents} selectedContinent={selectedContinent} mode={mode} onCountry={(code, name) => { if (data && !loading) setSelected({ code, name }); }} onContinent={name => setSelectedContinent(previous => previous === name ? null : name)} /></View>
      {mode === 'continents' && data ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{data.continents.map(continent => <Pressable key={continent.name} accessibilityRole="button" accessibilityState={{ selected: selectedContinent === continent.name }} onPress={() => setSelectedContinent(previous => previous === continent.name ? null : continent.name)} style={[styles.continent, { backgroundColor: resolvePresentationColor(selectedContinent === continent.name ? (theme.dark ? '#153552' : '#E6F2FF') : surface, 'backgroundColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontWeight: '600' })}>{continent.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12, marginTop: 6 })}>{continent.countries_visited} {continent.countries_visited === 1 ? 'country' : 'countries'} visited</Text></Pressable>)}</ScrollView> : null}
      {stats ? <View style={[styles.progress, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'surface') }]}>
        <View style={styles.row}><View><Text style={presentationTextStyle([styles.number, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{stats.countries}<Text style={{ color: resolvePresentationColor(theme.subtle, 'color', 'content'), fontSize: 24 }}> / {stats.country_total}</Text></Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 5 })}>countries explored</Text></View><View style={{ alignItems: 'flex-end' }}><Text style={presentationTextStyle([styles.number, { color: resolvePresentationColor(theme.accent, 'color', 'content') }])}>{Math.round(stats.world_percentage)}%</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 5 })}>of the world</Text></View></View>
        <View style={[styles.track, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}><View style={{ height: 4, borderRadius: 2, backgroundColor: resolvePresentationColor(theme.accent, 'backgroundColor', 'content'), width: `${Math.min(100, stats.world_percentage)}%` }} /></View>
      </View> : null}
      {data && !stats?.countries ? <View style={styles.empty}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 19, fontWeight: '600' })}>A whole world of memories awaits</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), lineHeight: 22, marginVertical: 10 })}>Create a journey with a destination and watch your world fill with color.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/journey/new')} style={styles.link}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontWeight: '600' })}>Create a journey →</Text></Pressable></View> : null}
      {stats?.unassigned_journeys ? <Text style={presentationTextStyle([styles.notice, { color: resolvePresentationColor(theme.muted, 'color', 'content'), lineHeight: 20 }])}>{countLabel(stats.unassigned_journeys, 'journey')} with an unrecognized country. Edit the destination to include {stats.unassigned_journeys === 1 ? 'it' : 'them'} in your world.</Text> : null}
      {data?.countries.length ? <>
        <Pressable accessibilityRole="button" onPress={() => router.push('/world/countries')} style={[styles.sectionHeading, styles.row]}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontWeight: '600', fontSize: 21 })}>Recently visited</Text><Ionicons name="arrow-forward" size={20} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{data.recently_visited.map(code => { const item = countries.get(code); if (!item) return null; return <Pressable key={code} accessibilityRole="button" accessibilityLabel={`View ${item.name}, ${countLabel(item.journey_count, 'journey')}`} onPress={() => openCountry(code)} style={styles.countryCard}>
          {item.cover_url ? <Image source={cachedImageSource(item.cover_url, `travel:${code}`)} style={styles.cover} contentFit="cover" transition={reducedMotion ? 0 : 180} /> : <View style={[styles.cover, styles.placeholder, { backgroundColor: resolvePresentationColor(surface, 'backgroundColor', 'surface') }]}><Text style={presentationTextStyle({ fontSize: 38 })}>{countryFlag(code)}</Text></View>}
          <Text numberOfLines={1} style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 16, fontWeight: '600', marginTop: 10 })}>{item.name}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, marginTop: 4 })}>{countLabel(item.journey_count, 'journey')}</Text>
        </Pressable>; })}</ScrollView>
      </> : null}
    </ScrollView>
    <Modal visible={!!selected} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={dismiss}>
      <View style={styles.modal}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss country details" onPress={dismiss} style={[StyleSheet.absoluteFill, { backgroundColor: resolvePresentationColor('rgba(0,0,0,0.32)', 'backgroundColor', 'control') }]} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface'), paddingBottom: insets.bottom + 24 }]}>
          <View {...pan.panHandlers} style={styles.handleArea}><View style={[styles.handle, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]} /></View>
          <View style={styles.row}><Text accessibilityRole="header" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 26, fontWeight: '600', flex: 1 })}>{selected ? countryFlag(selected.code) : ''} {selected?.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close country details" onPress={dismiss} style={styles.icon}><Ionicons name="close" size={23} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></Pressable></View>
          {country ? <><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 8 })}>{countLabel(country.journey_count, 'journey')} · {countLabel(country.photo_count, 'photo')}</Text><ScrollView style={{ maxHeight: 170, marginVertical: 18 }}>{country.cities.map(city => <Text key={city} style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 16, paddingVertical: 6 })}>{city}</Text>)}</ScrollView><Pressable accessibilityRole="button" onPress={() => openCountry(country.code)} style={[styles.button, { backgroundColor: resolvePresentationColor(theme.accent, 'backgroundColor', 'control') }]}><Text style={presentationTextStyle({ color: resolvePresentationColor('#FFFFFF', 'color', 'content'), fontWeight: '600', fontSize: 16 })}>View journeys →</Text></Pressable></> : <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginVertical: 24 })}>Not visited yet</Text>}
        </View>
      </View>
    </Modal>
  </View>;
}
const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, marginBottom: 24 }, eyebrow: { fontSize: 10, letterSpacing: 2.2, fontWeight: '600', marginBottom: 10 }, title: { fontSize: 36, letterSpacing: -1.4, fontWeight: '700' }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  segment: { marginHorizontal: 24, padding: 4, borderRadius: 12, flexDirection: 'row', marginBottom: 22 }, indicator: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: 9 }, segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center' }, map: { marginHorizontal: 16 }, progress: { margin: 24, padding: 22, borderRadius: 24 }, number: { fontSize: 32, fontWeight: '600', letterSpacing: -1 }, track: { height: 4, borderRadius: 2, marginTop: 24, overflow: 'hidden' }, horizontal: { paddingHorizontal: 24, gap: 14, paddingTop: 14, paddingBottom: 6 }, continent: { borderRadius: 18, padding: 16, minWidth: 145 }, sectionHeading: { paddingHorizontal: 24, marginTop: 5 }, countryCard: { width: 156 }, cover: { width: 156, height: 126, borderRadius: 18 }, placeholder: { alignItems: 'center', justifyContent: 'center' }, notice: { marginHorizontal: 24, marginVertical: 14, fontSize: 13 }, empty: { paddingHorizontal: 24, marginBottom: 12 }, link: { minHeight: 44, justifyContent: 'center' }, modal: { flex: 1, justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 24, maxHeight: '75%' }, handleArea: { height: 30, alignItems: 'center', justifyContent: 'center' }, handle: { width: 36, height: 5, borderRadius: 3 }, button: { borderRadius: 16, padding: 16, minHeight: 50, alignItems: 'center' },
});
const presentationBaselineStyles = styles;

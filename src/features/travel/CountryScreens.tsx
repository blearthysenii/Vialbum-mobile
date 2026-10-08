import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useProfileTheme } from '@/features/profile/theme';
import { cachedImageSource } from '@/features/media/imageUrl';
import { formatDateRange } from '@/utils/format';
import { travelApi, countryFlag, countLabel, type CountryJourneys, type TravelProgress } from './api';

export function CountryScreen({ all = false }: { all?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { code } = useLocalSearchParams<{ code: string }>();
  const theme = useProfileTheme(), insets = useSafeAreaInsets();
  const [data, setData] = useState<CountryJourneys | null>(null);
  const [progress, setProgress] = useState<TravelProgress | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry; // Retry changes this focus request even while the screen stays focused.
    const controller = new AbortController();
    setLoading(true); setError(false); setData(null); setProgress(null);
    void (async () => {
      try {
        if (all) { const result = await travelApi.progress(controller.signal); if (!controller.signal.aborted) setProgress(result); }
        else { const result = await travelApi.journeys(code ?? '', controller.signal); if (!controller.signal.aborted) setData(result); }
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [all, code, retry]));
  const rows = all ? (progress?.countries ?? []).map(c => ({ id: c.code, title: `${countryFlag(c.code)} ${c.name}`, subtitle: countLabel(c.journey_count, 'journey'), cover: c.cover_url })) : (data?.journeys ?? []).map(j => ({ id: j.id, title: j.title, subtitle: `${j.destination} · ${formatDateRange(j.start_date, j.end_date)}`, cover: j.cover_url }));
  return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content'), paddingTop: insets.top }}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/map')} style={styles.back}><Ionicons name="chevron-back" size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable><View style={{ flex: 1 }}><Text accessibilityRole="header" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 25, fontWeight: '600' })}>{all ? 'Visited countries' : data ? `${countryFlag(data.country.code)} ${data.country.name}` : 'Country journeys'}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 4 })}>{all ? 'Most recently visited first' : data ? `${countLabel(data.country.journey_count, 'journey')} · ${countLabel(data.country.photo_count, 'photo')}` : 'Your travel memories'}</Text></View></View>
    {loading ? <ActivityIndicator color={resolvePresentationColor(theme.accent, 'color', 'content')} style={{ margin: 32 }} /> : error ? <Pressable accessibilityRole="button" onPress={() => setRetry(v => v + 1)} style={styles.notice}><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content') })}>Couldn’t load journeys. Tap to retry.</Text></Pressable> : <FlatList data={rows} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }} ListEmptyComponent={<Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 24 })}>No visited countries yet. Your next journey starts your world.</Text>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View ${item.title}`} onPress={() => all ? router.push({ pathname: '/world/country', params: { code: item.id } }) : router.push({ pathname: '/post/[id]', params: { id: item.id, scope: 'own' } })} style={styles.item}>
      {item.cover ? <Image source={cachedImageSource(item.cover, `travel-list:${item.id}`)} style={styles.image} contentFit="cover" /> : <View style={[styles.image, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content'), alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="images-outline" size={25} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></View>}
      <View style={{ flex: 1 }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontWeight: '600', fontSize: 17 })}>{item.title}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, lineHeight: 20, marginTop: 6 })}>{item.subtitle}</Text></View><Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />
    </Pressable>} />}
  </View>;
}
const styles = StyleSheet.create({ header: { padding: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }, back: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' }, item: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 }, image: { width: 80, height: 85, borderRadius: 16 }, notice: { padding: 24 } });
const presentationBaselineStyles = styles;

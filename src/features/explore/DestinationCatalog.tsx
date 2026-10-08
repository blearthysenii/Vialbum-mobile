import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfileTheme } from '@/features/profile/theme';
import { GlassButton } from '@/features/stays/StayGlass';
import { exploreApi, type Page, type PublicPlace } from './api';
import { DestinationCard, SearchSkeleton } from './DiscoveryContent';
export function DestinationCatalog() {
  const theme = useProfileTheme(), request = useRef<AbortController | null>(null), locked = useRef(false);
  const [page, setPage] = useState<Page<PublicPlace>>(), [loading, setLoading] = useState(false), [error, setError] = useState(false);
  const load = useCallback(async (cursor: string | null = null) => {
    if (locked.current) return; locked.current = true; const controller = new AbortController(); request.current = controller; setLoading(true); setError(false);
    try { const result = await exploreApi.destinations('', cursor, controller.signal); if (!controller.signal.aborted) setPage(previous => cursor && previous ? { ...result, items: [...new Map([...previous.items, ...result.items].map(item => [item.id, item])).values()] } : result); }
    catch { if (!controller.signal.aborted) { setError(true); if (!cursor) setPage(undefined); } }
    finally { if (!controller.signal.aborted) { locked.current = false; setLoading(false); } }
  }, []);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current?.abort(); locked.current = false; setPage(undefined); }; }, [load]));
  return <SafeAreaView style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}><View style={{ flexDirection: 'row', gap: 14, padding: 22, alignItems: 'center' }}><GlassButton label="Back" theme={theme} onPress={() => router.back()} radius={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></GlassButton><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 30, fontWeight: '700' })}>Explore</Text></View><FlatList data={page?.items ?? []} numColumns={2} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} renderItem={({ item }) => <View style={{ width: '50%', padding: 6 }}><DestinationCard place={item} theme={theme} onPress={() => router.push(`/explore/place/${item.id}`)} /></View>} ListEmptyComponent={loading ? <SearchSkeleton theme={theme} /> : !error ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), padding: 22 })}>Destinations appear here when travelers share public content.</Text> : null} ListFooterComponent={<>{error ? <Pressable style={{ minHeight: 44, padding: 22 }} onPress={() => void load(page?.next_cursor)}><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>Could not load destinations.</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Retry</Text></Pressable> : null}{page?.next_cursor && !error ? <Pressable disabled={loading} style={{ minHeight: 44, padding: 22 }} onPress={() => void load(page.next_cursor)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>{loading ? 'Loading…' : 'Load more'}</Text></Pressable> : null}</>} /></SafeAreaView>;
}

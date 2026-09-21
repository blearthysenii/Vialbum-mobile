import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '@/features/auth/AuthProvider';
import { DiscoverJourneyCard } from '@/features/discover/components/DiscoverJourneyCard';
import { DiscoverError } from '@/features/discover/components/DiscoverFeedback';
import { createDiscoverStore } from '@/features/discover/store';
import { useProfileTheme } from '@/features/profile/theme';
import { worldMapTarget } from '@/features/world/viewport';
import { exploreApi, type PublicPlace } from './api';

export function PlaceExploreScreen({ id }: { id: string }) {
  const { user } = useAuth();
  const theme = useProfileTheme();
  const [place, setPlace] = useState<PublicPlace | null>(null);
  const store = useMemo(() => createDiscoverStore(user?.id ?? '', async (cursor, signal) => {
    const response = await exploreApi.place(id, cursor, signal);
    if (!signal.aborted) setPlace(response.place);
    return response.journeys;
  }), [id, user?.id]);
  const feed = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  useFocusEffect(useCallback(() => { void store.refresh(); return () => { store.clear(); setPlace(null); }; }, [store]));
  const latitude = Number(place?.latitude), longitude = Number(place?.longitude);
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvas }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ padding: 16 }}><Ionicons name="chevron-back" size={25} color={theme.ink} /></Pressable>
    <FlashList data={feed.items} masonry numColumns={2} keyExtractor={item => item.id} contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 40 }}
      ListHeaderComponent={<View style={{ padding: 10 }}>{place && !feed.error ? <><Text style={{ color: theme.ink, fontSize: 30, fontWeight: '700' }}>{place.name}</Text><Text style={{ color: theme.muted, marginVertical: 8 }}>{[place.region, place.country].filter(Boolean).join(', ')}</Text>{Number.isFinite(latitude) && Number.isFinite(longitude) ? <MapView key={id} style={{ height: 150, borderRadius: 20, marginVertical: 12 }} userInterfaceStyle={theme.dark ? 'dark' : 'light'} initialRegion={{ latitude, longitude, latitudeDelta: 0.3, longitudeDelta: 0.3 }} scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}><Marker coordinate={{ latitude, longitude }} /></MapView> : null}<Pressable accessibilityRole="button" accessibilityLabel="View place on world map" onPress={() => router.push(worldMapTarget('explore', latitude, longitude))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.accent }}>View on map</Text></Pressable><Text style={{ fontSize: 21, fontWeight: '600', color: theme.ink, marginVertical: 16 }}>Journeys from this place</Text></> : null}{feed.error ? <DiscoverError message={feed.error} theme={theme} onRetry={() => void store.refresh()} /> : null}</View>}
      renderItem={({ item }) => <DiscoverJourneyCard journey={item} theme={theme} onOpen={journeyId => router.push({ pathname: '/post/[id]', params: { id: journeyId, scope: 'public' } })} />}
      ListEmptyComponent={feed.loading ? <ActivityIndicator color={theme.muted} /> : !feed.error ? <Text style={{ padding: 30, color: theme.muted }}>No public journeys here yet.</Text> : null}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={theme.muted} /> : null}
      onEndReached={() => { if (!feed.error) void store.loadMore(); }} onEndReachedThreshold={0.5}
      refreshControl={<RefreshControl refreshing={feed.loading && feed.loaded} onRefresh={() => void store.refresh()} tintColor={theme.muted} />} />
  </SafeAreaView>;
}

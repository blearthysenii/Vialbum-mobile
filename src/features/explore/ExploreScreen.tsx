import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DiscoverJourneyCard } from '@/features/discover/components/DiscoverJourneyCard';
import { FollowButton } from '@/features/follows/FollowButton';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import { useProfileTheme } from '@/features/profile/theme';
import LibrarySearchScreen from '@/features/search/LibrarySearchScreen';
import { recentSearchStorage } from '@/features/search/storage';
import { addRecentSearch } from '@/features/search/utils';
import { exploreApi, type Category, type SearchResults } from './api';
import { createExploreStore } from './store';

type Row = { key: string; category: Category; index: number };
function resultRows(results: SearchResults | null): Row[] {
  if (!results) return [];
  return (['users', 'journeys', 'places'] as const).flatMap(category => {
    const count = results[category].items.length;
    return Array.from({ length: category === 'journeys' ? Math.ceil(count / 2) : count }, (_, index) => ({ category, index, key: `${category}:${index}` }));
  });
}
export function ExploreScreen() {
  const theme = useProfileTheme();
  const store = useMemo(() => createExploreStore(exploreApi.search), []);
  const search = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [recent, setRecent] = useState<string[]>([]);
  const [storageError, setStorageError] = useState(false);
  const [library, setLibrary] = useState(false);
  useEffect(() => { let active = true; void recentSearchStorage.get().then(items => { if (active) setRecent(items); }).catch(() => { if (active) setStorageError(true); }); return () => { active = false; }; }, []);
  useFocusEffect(useCallback(() => { if (!library) void store.refresh(); return () => store.suspend(); }, [store, library]));
  function saveRecent(items: string[]) { setRecent(items); setStorageError(false); void recentSearchStorage.set(items).catch(() => setStorageError(true)); }
  const remember = () => { if (search.query.trim().replace(/^@/, '').length >= 2) saveRecent(addRecentSearch(recent, search.query.trim())); };
  const openJourney = (id: string) => { remember(); router.push({ pathname: '/post/[id]', params: { id, scope: 'public' } }); };
  const labels = { users: 'People', journeys: 'Journeys', places: 'Places' };
  if (library) return <View style={{ flex: 1, backgroundColor: theme.canvas }}><SafeAreaView edges={['top']}><Pressable style={styles.link} onPress={() => setLibrary(false)}><Text style={{ color: theme.ink }}>‹ Explore</Text></Pressable></SafeAreaView><LibrarySearchScreen /></View>;
  return <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.canvas }}>
    <View style={styles.heading}><Text style={[styles.title, { color: theme.ink }]}>Search</Text><Pressable onPress={() => setLibrary(true)}><Text style={{ color: theme.muted }}>My library</Text></Pressable></View>
    <View style={[styles.field, { backgroundColor: theme.glassStrong }]}><Ionicons name="search" size={20} color={theme.muted} /><TextInput style={[styles.input, { color: theme.ink }]} value={search.query} onChangeText={store.setQuery} maxLength={100} placeholder="Search places, journeys, people" placeholderTextColor={theme.muted} accessibilityLabel="Search places, journeys, people" autoCapitalize="none" autoCorrect={false} returnKeyType="search" onSubmitEditing={() => { remember(); Keyboard.dismiss(); void store.refresh(); }} />{search.query ? <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => store.setQuery('')}><Ionicons name="close-circle" size={22} color={theme.muted} /></Pressable> : null}</View>
    <FlatList data={resultRows(search.results)} keyExtractor={item => item.key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.content}
      ListHeaderComponent={<View>{search.loading ? <ActivityIndicator style={styles.link} color={theme.muted} /> : null}{search.error ? <Pressable onPress={() => void store.refresh()} style={styles.link}><Text accessibilityRole="alert" style={{ color: theme.danger }}>{search.error} Retry</Text></Pressable> : null}{storageError ? <Text style={{ color: theme.muted }}>Recent searches could not be saved or loaded.</Text> : null}
        {!search.query.trim() ? <View><View style={styles.heading}><Text style={[styles.section, { color: theme.ink }]}>Recent</Text><Pressable onPress={() => { setRecent([]); void recentSearchStorage.clear().catch(() => setStorageError(true)); }}><Text style={{ color: theme.muted }}>Clear all</Text></Pressable></View>{recent.map(item => <View key={item} style={styles.person}><Pressable style={styles.flex} onPress={() => store.setQuery(item)}><Text style={{ color: theme.ink }}>{item}</Text></Pressable><Pressable accessibilityLabel={`Remove ${item}`} onPress={() => saveRecent(recent.filter(value => value !== item))}><Ionicons name="close" size={20} color={theme.muted} /></Pressable></View>)}</View> : null}</View>}
      ListEmptyComponent={!search.loading && !search.error ? <Text style={[styles.empty, { color: theme.muted }]}>{search.results ? `No results for “${search.query.trim()}”` : search.query ? 'Type at least two characters.' : 'Find travelers, places, and your next inspiration.'}</Text> : null}
      renderItem={({ item: row }) => {
        const results = search.results!;
        const page = results[row.category];
        const last = row.category === 'journeys' ? row.index === Math.ceil(page.items.length / 2) - 1 : row.index === page.items.length - 1;
        return <View>{row.index === 0 ? <Text style={[styles.section, { color: theme.ink }]}>{labels[row.category]}</Text> : null}
          {row.category === 'users' ? (() => { const person = results.users.items[row.index]; return <View style={styles.person}><Pressable style={styles.identity} onPress={() => { remember(); router.push(`/public-profile/${person.id}`); }}><ProfileAvatarImage source={person.avatar_url} label={person.username} cacheKey={`creator:${person.id}`} style={styles.avatar} fallbackIconSize={22} /><View style={styles.flex}><Text style={{ color: theme.ink, fontWeight: '600' }}>{person.display_name}</Text><Text style={{ color: theme.muted }}>@{person.username}</Text></View></Pressable><FollowButton id={person.id} initial={person.is_following} compact /></View>; })() : row.category === 'journeys' ? <View style={styles.pair}>{results.journeys.items.slice(row.index * 2, row.index * 2 + 2).map(journey => <View key={journey.id} style={{ width: '50%' }}><DiscoverJourneyCard journey={journey} theme={theme} onOpen={openJourney} /></View>)}</View> : (() => { const place = results.places.items[row.index]; return <Pressable style={styles.person} onPress={() => { remember(); router.push(`/explore/place/${place.id}`); }}><Ionicons name="location-outline" size={25} color={theme.muted} /><View style={styles.flex}><Text style={{ color: theme.ink, fontWeight: '600' }}>{place.name}</Text><Text style={{ color: theme.muted }}>{[place.locality, place.region, place.country].filter(Boolean).join(', ')}</Text><Text style={{ color: theme.subtle }}>{place.public_journeys_count} public journeys</Text></View><Ionicons name="chevron-forward" size={18} color={theme.subtle} /></Pressable>; })()}
          {last && page.next_cursor ? <Pressable disabled={Boolean(search.more)} style={styles.link} onPress={() => void store.loadMore(row.category)}>{search.more === row.category ? <ActivityIndicator color={theme.muted} /> : <Text style={{ color: theme.muted }}>More {labels[row.category].toLowerCase()}</Text>}</Pressable> : null}
        </View>;
      }} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 12 }, title: { fontSize: 32, fontWeight: '700', letterSpacing: -1 }, section: { fontSize: 21, fontWeight: '600', marginVertical: 16 }, field: { marginHorizontal: 20, borderRadius: 17, paddingHorizontal: 12, minHeight: 50, flexDirection: 'row', gap: 8, alignItems: 'center' }, input: { flex: 1, fontSize: 15, paddingVertical: 12 }, content: { padding: 15, paddingBottom: 140 }, person: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 13, paddingHorizontal: 5 }, identity: { flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }, flex: { flex: 1 }, avatar: { width: 46, height: 46, borderRadius: 23 }, pair: { flexDirection: 'row', alignItems: 'flex-start' }, link: { padding: 16, alignItems: 'center' }, empty: { padding: 35, textAlign: 'center', lineHeight: 22 } });

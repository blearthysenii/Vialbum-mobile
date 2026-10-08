import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { ProfileTheme } from '@/features/profile/theme';
import type { Stay } from '@/features/stays/api';
import type { Category, SearchResults } from './api';
import { StayResults } from './DiscoveryContent';
import { appendMix, mediaBlocks, mediaTiles, type MediaTile } from './mediaGrid';
const types = ['journeys', 'moments', 'stays'] as const;
export function ForYouGrid({ revision = 0, results, loading, more, error, query, theme, refresh, loadMore, onJourney, onOpen }: { revision?: number; results: SearchResults | null; loading: boolean; more: Category | null; error: string | null; query: string; theme: ProfileTheme; refresh: () => Promise<void>; loadMore: (type: Category) => Promise<void>; onJourney: (id: string) => void; onOpen: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [initialSeed] = useState(() => String(Math.random()));
  const session = useRef({ seed: initialSeed, revision, query, tiles: [] as MediaTile[], results: null as SearchResults | null });
  const [, update] = useState(0), [width, setWidth] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pageTurn = useRef(0);
  useEffect(() => {
    if (!results) { session.current.tiles = []; session.current.results = null; update(value => value + 1); return; }
    if (query !== session.current.query || revision !== session.current.revision) session.current = { seed: String(Math.random()), revision, query, tiles: [], results: null };
    if (results !== session.current.results) {
      session.current.tiles = appendMix(session.current.tiles, mediaTiles(results), session.current.seed);
      session.current.results = results;
      update(value => value + 1);
    }
  }, [results, query, revision]);
  const next = () => {
    if (loading || more || error || !results) return;
    for (let i = 0; i < types.length; i++) {
      const type = types[(pageTurn.current + i) % types.length];
      if (results[type].next_cursor) { pageTurn.current = (pageTurn.current + i + 1) % types.length; void loadMore(type); return; }
    }
  };
  // Continue across pages containing no usable media, rather than stranding an empty feed.
  useEffect(() => { if (!loading && !more && !error && session.current.tiles.length < 18) next(); });
  const blocks = mediaBlocks(query === session.current.query && results ? session.current.tiles : [], session.current.seed);
  const size = Math.max(0, (width - 4) / 3);
  const stays = session.current.tiles.flatMap(tile => tile.stay ? [tile.stay] : []);
  const pullRefresh = async () => {
    session.current = { seed: String(Math.random()), revision, query, tiles: [], results: null }; pageTurn.current = 0;
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };
  const cell = (tile: MediaTile | undefined, height: number, openStay: (stay: Stay) => void) => tile ? <Pressable key={tile.key} accessibilityRole="button" accessibilityLabel={`Open ${tile.type}`} onPress={() => { if (tile.type === 'journey') onJourney(tile.id); else { onOpen(); if (tile.stay) openStay(tile.stay); else router.push(`/moment/${tile.id}`); } }} style={{ width: size, height, backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control') }}>
    <Image source={cachedImageSource(tile.url, `explore:${tile.key}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={tile.key} />
    <Ionicons name={tile.type === 'journey' ? 'map-outline' : tile.type === 'stay' ? 'bed-outline' : 'play'} size={16} color={resolvePresentationColor("#fff", 'color', 'content')} style={styles.icon} />
  </Pressable> : <View style={{ width: size, height }} />;
  return <View style={styles.flex} onLayout={event => setWidth(event.nativeEvent.layout.width)}><StayResults items={stays} theme={theme}>{openStay => <FlatList data={blocks} keyExtractor={block => block.key} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={8} windowSize={7} maxToRenderPerBatch={8} onEndReached={next} onEndReachedThreshold={.7} refreshing={refreshing} onRefresh={() => void pullRefresh()} contentContainerStyle={{ paddingBottom: 40 }}
    ListHeaderComponent={error ? <Pressable accessibilityRole="button" onPress={() => void refresh()} style={styles.message}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>{error}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Retry</Text></Pressable> : null}
    ListEmptyComponent={!loading && !error ? <Text style={presentationTextStyle([styles.message, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{query.trim() ? results ? `No results for “${query.trim()}”` : 'Type at least two characters.' : 'Public travel photos will appear here as they are shared.'}</Text> : null}
    ListFooterComponent={loading || more ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={styles.message} /> : null}
    renderItem={({ item: block }) => !block.tall ? <View style={styles.row}>{block.items.map(tile => cell(tile, size, openStay))}</View> : <View style={[styles.row, { flexDirection: block.left ? 'row-reverse' : 'row' }]}><View style={{ gap: 2 }}><View style={styles.innerRow}>{cell(block.items[0], size, openStay)}{cell(block.items[1], size, openStay)}</View><View style={styles.innerRow}>{cell(block.items[2], size, openStay)}{cell(block.items[3], size, openStay)}</View></View>{cell(block.items[4], size * 2 + 2, openStay)}</View>} />}</StayResults></View>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, row: { flexDirection: 'row', gap: 2, marginBottom: 2 }, innerRow: { flexDirection: 'row', gap: 2 }, message: { padding: 22, textAlign: 'center' }, icon: { position: 'absolute', top: 7, right: 7, textShadowColor: 'rgba(0,0,0,.6)', textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } } });
const presentationBaselineStyles = styles;

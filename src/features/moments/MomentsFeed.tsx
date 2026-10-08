import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { JourneyTravelOverlay } from './JourneyTravelOverlay';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { setStatusBarStyle } from 'expo-status-bar';
import { useTabBarController, useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Pressable, RefreshControl, StyleSheet, Text, View, type ViewToken } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileTheme } from '@/features/profile/theme';
import { momentsApi } from './api';
import { createPlaybackGate } from './playback';
import type { FeedFilter, Moment } from './types';
import { MomentFrame } from './MomentFrame';
import type { MomentOption } from './MomentOptions';
import { navigationBottom, NAVIGATION_HEIGHT } from '@/features/navigation/geometry';

export function MomentsFeed({ initialId, filter = {}, embedded = false }: { initialId?: string; filter?: FeedFilter; embedded?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const appTheme = useProfileTheme();
  const theme = { ...appTheme, canvas: '#000000', ink: '#FFFFFF', muted: '#A1A1A6' };
  const tabBarScroll = useTabBarScroll();
  const { interactionLocked } = useTabBarController();
  const { user } = useAuth(); const insets = useSafeAreaInsets();
  const gate = useMemo(() => createPlaybackGate(), []);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const [mode, setMode] = useState<'following' | 'explore'>(filter.mode ?? 'explore');
  const [items, setItems] = useState<Moment[]>([]); const itemsRef = useRef(items); itemsRef.current = items;
  const [activeIndex, setActiveIndex] = useState(0); const [height, setHeight] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false); const [loading, setLoading] = useState(false); const busy = useRef(false);
  const [error, setError] = useState<string | null>(null); const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true); const [replay, setReplay] = useState(0);
  const [teleporting, setTeleporting] = useState(false);
  const [playbackVisible, setPlaybackVisible] = useState(false);
  const positions = useRef(new Map<string, number>());
  const [retryVersions, setRetryVersions] = useState<Record<string, number>>({});
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  const cursor = useRef<string | null>(null); const request = useRef<AbortController | null>(null);
  const focused = useRef(false); const list = useRef<FlatList<Moment>>(null); const excluded = useRef<string[]>([]);
  const active = items[activeIndex];
  const activeRef = useRef(active); activeRef.current = active;
  const filterKey = JSON.stringify({ ...filter, mode });
  const load = useCallback(async (more = false) => {
    if (busy.current || (more && !cursor.current)) return;
    busy.current = true; setLoading(true); setError(null);
    const controller = new AbortController(); request.current = controller;
    try {
      const query = JSON.parse(filterKey) as FeedFilter;
      const first = !more && initialId ? await momentsApi.get(initialId, controller.signal) : null;
      if (first && first.status !== 'published') throw new Error('This Moment has not been shared yet.');
      const page = await momentsApi.page(query, more ? cursor.current : first?.feed_cursor, controller.signal);
      const next = first ? [first, ...page.items.filter(item => item.id !== first.id)] : page.items;
      if (controller.signal.aborted) return;
      cursor.current = page.next_cursor;
      setItems(old => more ? [...old, ...next.filter(item => !old.some(previous => previous.id === item.id))] : next);
      if (!more) { setActiveIndex(0); list.current?.scrollToOffset({ offset: 0, animated: false }); }
      setLoaded(true);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Moments could not be loaded.'); }
    finally { if (request.current === controller) { busy.current = false; setLoading(false); } }
  }, [filterKey, initialId]);
  useEffect(() => { void load(); return () => { request.current?.abort(); busy.current = false; gate.stop(); }; }, [load, gate]);
  useFocusEffect(useCallback(() => {
    setPlaybackVisible(true); focused.current = true; setStatusBarStyle('light');
    const current = activeRef.current; const controller = new AbortController();
    if (!current) { void load(); gate.allow(AppState.currentState === 'active'); }
    else {
      gate.stop(); setValidatingId(current.id);
      void momentsApi.get(current.id, controller.signal).then(updated => {
        if (controller.signal.aborted) return;
        setItems(old => old.map(item => item.id === updated.id ? updated : item));
        setValidatingId(null);
        gate.allow(AppState.currentState === 'active');
      }).catch(() => { if (!controller.signal.aborted) {
        const next = itemsRef.current.filter(item => item.id !== current.id);
        setItems(next); setActiveIndex(index => Math.min(index, Math.max(0, next.length-1)));
        setValidatingId(null); setError('This Moment is unavailable.');
        gate.allow(AppState.currentState === 'active');
      } });
    }
    return () => { controller.abort(); request.current?.abort(); busy.current = false; setLoading(false); setPlaybackVisible(false); focused.current = false; gate.stop(); setStatusBarStyle(appTheme.dark ? 'light' : 'dark'); };
  }, [gate, appTheme.dark, load]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { gate.allow(focused.current && state === 'active'); setPlaybackVisible(focused.current && state === 'active'); });
    return () => subscription.remove();
  }, [gate]);
  useEffect(() => {
    gate.select(active?.id ?? null, active?.audio_muted); gate.pause(paused); gate.mute(muted);
    if (active) excluded.current = [...excluded.current.filter(id => id !== active.id), active.id].slice(-24);
  }, [active, paused, muted, gate]);
  useEffect(() => {
    if (!active?.media_expires_at) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (!focused.current || AppState.currentState !== 'active') return;
      void momentsApi.get(active.id, controller.signal).then(updated => {
        if (!controller.signal.aborted) setItems(old => old.map(item => item.id === updated.id ? updated : item));
      }).catch(() => { if (!controller.signal.aborted) setFailedId(active.id); });
    }, Math.max(1000, Date.parse(active.media_expires_at)-Date.now()-30000));
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [active]);
  const viewable = useRef(({ viewableItems }: { viewableItems: ViewToken<Moment>[] }) => {
    const visible = viewableItems.find(item => item.isViewable && item.index !== null);
    if (visible?.index !== undefined && visible.index !== null) {
      const item = itemsRef.current[visible.index]; gate.select(item?.id ?? null, item?.audio_muted);
      gate.pause(false); setActiveIndex(visible.index); setPaused(false); setFailedId(null);
    }
  }).current;
  const refreshVideo = async (item: Moment) => {
    setFailedId(item.id);
    try { const updated = await momentsApi.get(item.id); setItems(old => old.map(previous => previous.id === item.id ? updated : previous)); setRetryVersions(old => ({ ...old, [item.id]: (old[item.id] ?? 0)+1 })); setFailedId(null); }
    catch { setError('This video is unavailable. Retry or swipe to another place.'); }
  };
  const teleport = async () => {
    if (teleporting) return; setTeleporting(true); gate.stop();
    try {
      const next = await momentsApi.teleport(active, excluded.current); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      const target = activeIndex + 1;
      setItems(old => { const rest = old.filter(item => item.id !== next.id); return [...rest.slice(0, target), next, ...rest.slice(target)]; });
      setActiveIndex(target); setPaused(false); gate.pause(false); gate.select(next.id, next.audio_muted);
      gate.allow(focused.current && AppState.currentState === 'active');
      requestAnimationFrame(() => list.current?.scrollToOffset({ offset: target*height, animated: true }));
    }
    catch (failure) { Alert.alert('Teleport', failure instanceof Error ? failure.message : 'Try again.'); gate.allow(focused.current && AppState.currentState === 'active'); }
    finally { setTeleporting(false); }
  };
  const remove = () => { if (!active) return; Alert.alert('Delete Moment?', 'The video and its cover will be removed.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
    gate.stop(); void momentsApi.delete(active.id).then(() => { if (initialId) router.back(); else { request.current?.abort(); busy.current = false; void load(); } }).catch(failure => { Alert.alert('Deletion failed', String(failure.message)); router.replace('/moment/drafts'); });
  } }]); };
  const openJourney = (item: Moment) => { if (item.journey_id) router.push({ pathname: '/post/[id]', params: { id: item.journey_id, scope: item.creator.id === user?.id ? 'own' : 'public' } }); };
  const options: MomentOption[] = active ? [
    ...(!active.audio_muted ? [{ title: muted ? 'Turn sound on' : 'Mute video', run: () => setMuted(value => !value) }] : []),
    { title: 'Replay video', run: () => { setReplay(value => value + 1); setPaused(false); } },
    ...(active.caption ? [{ title: 'Moment details', run: () => Alert.alert(active.place.name, active.caption!) }] : []),
    ...(active.journey_id ? [{ title: 'Open linked journey', run: () => openJourney(active) }] : []),
    { title: 'Open location on Map', run: () => router.push({ pathname: '/world/places', params: { worldMode: 'explore', latitude: active.place.latitude, longitude: active.place.longitude, focusPlaceName: active.place.name, focusRequest: String(Date.now()) } }) },
    ...(mode === 'explore' ? [{ title: teleporting ? 'Teleporting…' : 'Teleport to another place', run: () => void teleport() }] : []),
    ...(active.creator.id === user?.id ? [{ title: 'Delete Moment', run: remove, destructive: true }] : []),
  ] : [];
  const timelineBottom = embedded ? navigationBottom(insets.bottom) + NAVIGATION_HEIGHT + 6 : insets.bottom + 12;
  return <View style={[styles.screen, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]} onLayout={event => setHeight(event.nativeEvent.layout.height)}>
    {height > 0 && items.length > 0 ? <GestureDetector gesture={scrollGesture}><FlatList scrollEnabled={!interactionLocked} {...(embedded ? tabBarScroll : {})} ref={list} data={items} keyExtractor={item => item.id} pagingEnabled bounces alwaysBounceVertical refreshControl={<RefreshControl refreshing={refreshing} tintColor={resolvePresentationColor(theme.ink, 'tintColor', 'content')} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />}
      getItemLayout={(_, index) => ({ length: height, offset: height*index, index })} showsVerticalScrollIndicator={false}
      initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3} removeClippedSubviews={false}
      onViewableItemsChanged={viewable} viewabilityConfig={{ itemVisiblePercentThreshold: 70 }}
      onEndReached={() => { if (loaded) void load(true); }} onEndReachedThreshold={1.5}
      renderItem={({ item, index }) => <MomentFrame scrollGesture={scrollGesture} item={item} height={height} active={index === activeIndex}
        preload={index === activeIndex + 1} visible={playbackVisible} validating={validatingId === item.id}
        failed={failedId === item.id} retryVersion={retryVersions[item.id] ?? 0} positions={positions.current}
        gate={gate} paused={paused} muted={muted} toggleMute={() => setMuted(value => !value)} replay={replay} togglePlayback={() => setPaused(value => !value)}
        onError={() => setFailedId(item.id)} interrupted={() => { if (gate.intendsToPlay(item.id)) setPaused(true); }}
        retry={() => void refreshVideo(item)} bottom={timelineBottom} options={options} openJourney={() => openJourney(item)} />}
      /></GestureDetector> : <View style={styles.empty}>{loading || !loaded && !error ? <ActivityIndicator color={resolvePresentationColor(theme.ink, 'color', 'content')} /> : <><Text style={presentationTextStyle(styles.emptyTitle)}>{error || (mode === 'following' ? 'Your world is quiet.' : 'Be the first to share a place.')}</Text><Text style={presentationTextStyle(styles.emptyCopy)}>{mode === 'following' ? 'Follow travelers from their profiles, or explore Moments.' : 'Share a short video from somewhere you’ve been.'}</Text><Pressable onPress={() => error ? void load() : mode === 'following' ? setMode('explore') : router.push('/moment/new')}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>{error ? 'Retry' : mode === 'following' ? 'Explore Moments' : 'Create a Moment'}</Text></Pressable></>}</View>}
    <JourneyTravelOverlay item={active} visible={playbackVisible} blocked={interactionLocked} />
    <View pointerEvents={interactionLocked ? 'none' : 'auto'} style={[styles.top, { top: insets.top + 4 }]}>
      <Action icon={!embedded && initialId ? 'chevron-back' : 'add'} label={!embedded && initialId ? 'Back' : 'New Moment'}
        onPress={() => !embedded && initialId ? router.back() : router.push('/moment/new')} />
      <View style={{ flex: 1 }} />
      <Action icon="search-outline" label="Search places and travelers" onPress={() => router.push('/explore')} />
    </View>
    {error && items.length > 0 ? <Pressable style={[styles.error, { top: insets.top + 60 }]} onPress={() => void load(true)}><Text style={presentationTextStyle(styles.errorText)}>{error} · Retry</Text></Pressable> : null}
  </View>;
}
function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={4} onPress={onPress} style={styles.action}><Ionicons name={icon} size={24} color={resolvePresentationColor("white", 'color', 'content')} /></Pressable>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  action: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 35, gap: 20 },
  emptyTitle: { color: 'white', fontSize: 23, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: '#A1A1A6', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  error: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(35,35,35,0.9)', padding: 12, borderRadius: 14 },
  errorText: { color: 'white', fontSize: 14, lineHeight: 20 },
});
const presentationBaselineStyles = styles;

import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ActionSheetIOS, Alert, Platform, StyleSheet, Text, View } from 'react-native';
import type { PostJourney } from '@/features/posts/data';
import type { ProfileTheme } from '@/features/profile/theme';
import { staysApi, stayPoint, stayPoints, type Stay, type StayPage, type StayPoint, type StayTip } from './api';
import { Action } from './StayUI';
import { StayDetail } from './StayDetail';
import { StayEditor } from './StayEditor';
import { GlassButton } from './StayGlass';
import { StayCard } from './StayCard';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Couldn’t load stays. Please try again.';
export function StaysTab({ journey, own, theme, onMap, onMarkers }: { journey: PostJourney; own: boolean; theme: ProfileTheme; onMap: (point: StayPoint) => void; onMarkers: (points: StayPoint[]) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [page, setPage] = useState<StayPage>();
  const [loading, setLoading] = useState(true), [error, setError] = useState<string>(), [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false), [exploring, setExploring] = useState(false), [editing, setEditing] = useState<StayTip>();
  const [detail, setDetail] = useState<Stay>(), [detailLoading, setDetailLoading] = useState(false), [detailError, setDetailError] = useState<string>();
  const request = useRef<AbortController | null>(null), loadLock = useRef(false);
  const refresh = () => setAttempt(value => value + 1);
  useFocusEffect(useCallback(() => {
    const controller = new AbortController(); setLoading(true); setError(undefined);
    staysApi.list(journey.id, 0, controller.signal).then(value => { if (!controller.signal.aborted) { setPage(value); if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[JourneyStays]', { journeyId: journey.id, count: value.journey_items?.length ?? value.items.length }); onMarkers(stayPoints([...(value.journey_items ?? []), ...value.items])); } }).catch(error => { if (!controller.signal.aborted) setError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // The retry counter deliberately restarts this focused request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey.id, attempt, onMarkers]));
  useEffect(() => () => request.current?.abort(), []);
  const open = (stay: Stay) => { request.current?.abort(); const controller = new AbortController(); request.current = controller; setDetail(stay); setDetailLoading(true); setDetailError(undefined); staysApi.detail(stay.id, 0, controller.signal, journey.id).then(value => { if (!controller.signal.aborted) setDetail(value); }).catch(error => { if (!controller.signal.aborted) setDetailError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); }); };
  const closeDetail = () => { request.current?.abort(); setDetail(undefined); };
  const more = async () => { if (page?.next_offset == null || loadLock.current) return; loadLock.current = true; setLoading(true); try { const next = await staysApi.list(journey.id, page.next_offset); const value = { ...page, items: [...page.items, ...next.items], next_offset: next.next_offset }; setPage(value); onMarkers(stayPoints([...(value.journey_items ?? []), ...value.items])); } catch (error) { setError(errorText(error)); } finally { loadLock.current = false; setLoading(false); } };
  const edit = (tip: StayTip) => { closeDetail(); setEditing(tip); setAdding(true); };
  const remove = (tip: StayTip) => Alert.alert('Remove recommendation?', 'Your journey and its photos will be kept.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { staysApi.remove(tip.id).then(() => { closeDetail(); refresh(); }).catch(error => setDetailError(errorText(error))); } }]);
  const moreDetail = () => {
    if (!detail || detail.next_offset == null || detailLoading) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setDetailLoading(true); setDetailError(undefined);
    staysApi.detail(detail.id, detail.next_offset, controller.signal, journey.id).then(value => {
      if (!controller.signal.aborted) setDetail({ ...detail, tips: [...detail.tips, ...value.tips], next_offset: value.next_offset });
    }).catch(error => { if (!controller.signal.aborted) setDetailError(errorText(error)); }).finally(() => { if (!controller.signal.aborted) setDetailLoading(false); });
  };
  const personal = page?.journey_items ?? page?.items ?? [];
  const nearby = page?.journey_items ? page.items.filter(stay => !personal.some(item => item.id === stay.id)) : [];
  const menu = (tip: StayTip) => {
    if (!tip.own) return;
    const actions = [...(!tip.photos?.length ? [{ text: 'Add photos', onPress: () => edit(tip) }] : []), { text: 'Edit stay', onPress: () => edit(tip) }, { text: 'Remove stay', style: 'destructive' as const, onPress: () => remove(tip) }];
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: ['Cancel', ...actions.map(action => action.text)], cancelButtonIndex: 0, destructiveButtonIndex: actions.length }, index => { if (index > 0) actions[index - 1].onPress(); });
    else Alert.alert('Stay options', undefined, [...actions, { text: 'Cancel', style: 'cancel' }]);
  };
  const cards = (items: Stay[]) => items.map(stay => {
    const tip = stay.tips[0], point = stayPoint(stay);
    return <StayCard key={stay.id} stay={stay} theme={theme} onOpen={() => open(stay)} onRetry={refresh} onMap={point ? () => onMap(point) : undefined} onMenu={tip?.own ? () => menu(tip) : undefined} />;
  });
  return <View style={styles.section}><View style={styles.staysHeader}><View style={{ flex: 1 }}><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Stays</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 15, marginTop: 5 })}>{`Where ${own ? 'you' : journey.creator?.display_name || journey.creator?.username || 'this traveler'} stayed${journey.destination ? ` in ${journey.destination}` : ''}`}</Text></View>{own && personal.length ? <GlassButton label="Recommend another stay" theme={theme} hitSlop={8} onPress={() => { setEditing(undefined); setAdding(true); }} style={styles.addButton}><Ionicons name="add" size={23} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></GlassButton> : null}</View>{cards(personal)}{nearby.length ? <><Text style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>More traveler recommendations nearby</Text>{cards(nearby)}</> : null}{loading ? <ActivityIndicator accessibilityLabel="Loading stays" color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}{error ? <><Text accessibilityRole="alert" style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content') })}>{error}</Text><Action label="Retry" theme={theme} onPress={refresh} /></> : null}{!loading && !error && !personal.length && !nearby.length ? <View style={styles.empty}><Ionicons name="bed-outline" size={28} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{own ? 'No stays yet' : 'No stays shared yet'}</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), lineHeight: 22, textAlign: 'center' })}>{own ? 'Share where you stayed and help other travelers plan their trip.' : `${journey.creator?.display_name || journey.creator?.username || 'This traveler'} hasn’t shared where they stayed on this journey.`}</Text>{own ? <Action label="Recommend a stay" theme={theme} onPress={() => { setEditing(undefined); setAdding(true); }} /> : null}</View> : null}{page?.next_offset != null ? <Action label="More stays" theme={theme} disabled={loading} onPress={() => void more()} /> : null}
    {adding || exploring ? <StayEditor journey={journey} destinations={page?.destinations ?? []} initial={editing} own={own && adding} theme={theme} onClose={() => { setAdding(false); setExploring(false); setEditing(undefined); }} onSaved={() => { setAdding(false); setEditing(undefined); refresh(); }} onMap={point => { setExploring(false); onMap(point); }} /> : null}
    {detail ? <StayDetail stay={detail} theme={theme} loading={detailLoading} error={detailError} onClose={closeDetail} onRetry={() => open(detail)} onMenu={menu} onMap={onMap} onMore={moreDetail} /> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: 0, paddingBottom: 16 }, staysHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }, addButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, title: { fontSize: 22, fontWeight: '600', letterSpacing: -.5 }, name: { fontSize: 18, fontWeight: '600', marginTop: 12 }, proof: { fontSize: 13, marginTop: 10 }, tip: { fontSize: 16, lineHeight: 24, marginTop: 12 }, card: { marginBottom: 24 }, credit: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14 }, mapAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }, empty: { paddingVertical: 32, paddingHorizontal: 16, alignItems: 'center', gap: 10 }, traveler: { paddingVertical: 10 }, author: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 32, height: 32, borderRadius: 16 }, content: { padding: 22, gap: 14 }, map: { height: 160, borderRadius: 20, overflow: 'hidden' } });
const presentationBaselineStyles = styles;

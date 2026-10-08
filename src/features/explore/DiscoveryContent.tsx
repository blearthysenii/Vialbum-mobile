import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cachedImageSource } from '@/features/media/imageUrl';
import { postMediaShape } from '@/features/posts/mediaShape';
import type { ProfileTheme } from '@/features/profile/theme';
import { StayCard } from '@/features/stays/StayCard';
import { StayDetail } from '@/features/stays/StayDetail';
import { staysApi, stayPoint, type Stay } from '@/features/stays/api';
import { worldMapTarget } from '@/features/world/viewport';
import type { MomentPreview, PublicPlace } from './api';
export function DestinationCard({ place, theme, onPress }: { place: PublicPlace; theme: ProfileTheme; onPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${place.name}, ${place.country}`} onPress={onPress} style={({ pressed }) => [styles.destination, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control'), opacity: pressed ? .8 : 1 }]}>
    {place.cover_url ? <><Image source={cachedImageSource(place.cover_url, `destination:${place.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /><LinearGradient pointerEvents="none" colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,.7)'], 'colors', 'content')} style={styles.gradient} /></> : <Ionicons name="compass-outline" size={26} color={resolvePresentationColor(theme.muted, 'color', 'content')} style={{ margin: 16 }} />}
    <View style={styles.destinationCopy}><Text numberOfLines={2} style={presentationTextStyle({ color: resolvePresentationColor(place.cover_url ? '#fff' : theme.ink, 'color', 'content'), fontSize: 21, fontWeight: '600' })}>{place.name}</Text><Text numberOfLines={2} style={presentationTextStyle({ color: resolvePresentationColor(place.cover_url ? '#eee' : theme.muted, 'color', 'content'), marginTop: 4 })}>{place.country}</Text></View>
  </Pressable>;
}
export function MomentPreviews({ items, theme }: { items: MomentPreview[]; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.grid}>{items.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open Moment by ${item.creator.username}`} onPress={() => router.push(`/moment/${item.id}`)} style={[styles.moment, { backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'control') }]}>{item.cover_url ? <Image source={cachedImageSource(item.cover_url, `moment-cover:${item.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" /> : <Ionicons name="videocam-outline" size={24} color={resolvePresentationColor(theme.muted, 'color', 'content')} />}<Ionicons name="play" color={resolvePresentationColor(item.cover_url ? '#fff' : theme.ink, 'color', 'content')} size={18} style={{ position: 'absolute', right: 10, top: 10 }} /></Pressable>)}</View>;
}
export function StayResults({ items, theme, children }: { items: Stay[]; theme: ProfileTheme; children?: (open: (stay: Stay) => void) => ReactNode }) {
  const [detail, setDetail] = useState<Stay>(), [error, setError] = useState<string>(), [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const close = () => { request.current?.abort(); setDetail(undefined); setError(undefined); setLoading(false); };
  const open = async (stay: Stay, more = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setDetail(stay); setLoading(true); setError(undefined);
    try { const value = await staysApi.detail(stay.id, more ? stay.next_offset ?? 0 : 0, controller.signal); if (!controller.signal.aborted) setDetail(more ? { ...value, tips: [...stay.tips, ...value.tips] } : value); }
    catch { if (!controller.signal.aborted) setError('Stay could not be loaded. Please retry.'); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const map = (point: NonNullable<ReturnType<typeof stayPoint>>) => router.push(worldMapTarget('explore', point.latitude, point.longitude));
  return <>{children ? children(stay => { void open(stay); }) : items.map(stay => { const point = stayPoint(stay); return <StayCard key={stay.id} stay={stay} theme={theme} onOpen={() => void open(stay)} onRetry={() => void open(stay)} onMap={point ? () => map(point) : undefined} />; })}{detail ? <StayDetail stay={detail} theme={theme} loading={loading} error={error} onClose={close} onRetry={() => void open(detail)} onMore={() => { if (!loading) void open(detail, true); }} onMap={map} /> : null}</>;
}
export function SearchSkeleton({ theme }: { theme: ProfileTheme }) { return <View accessibilityLabel="Loading discovery" accessibilityRole="progressbar" style={{ gap: 16, paddingVertical: 20 }}>{[0, 1, 2].map(i => <View key={i} style={{ flexDirection: 'row', gap: 14 }}><View style={{ width: 58, height: 58, borderRadius: 14, backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'content') }} /><View style={{ flex: 1, gap: 10, justifyContent: 'center' }}><View style={{ height: 14, width: '70%', borderRadius: 5, backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'content') }} /><View style={{ height: 10, width: '45%', borderRadius: 5, backgroundColor: resolvePresentationColor(theme.elevatedSurface, 'backgroundColor', 'content') }} /></View></View>)}</View>; }
const styles = StyleSheet.create({ destination: { ...postMediaShape, aspectRatio: .85, overflow: 'hidden', justifyContent: 'flex-end' }, gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' }, destinationCopy: { padding: 16 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, moment: { width: '31%', aspectRatio: .65, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });
const presentationBaselineStyles = styles;

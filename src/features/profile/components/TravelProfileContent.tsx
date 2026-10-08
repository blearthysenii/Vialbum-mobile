import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo, useRef, useState } from 'react';
import MapView, { Marker } from 'react-native-maps';
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';

import type { ProfileJourney } from '@/features/profile/types';
import type { ProfileTheme } from '@/features/profile/theme';
import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#EEF1F3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#707780' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F7F8F9' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#D8E4EC' }] },
];

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#22272D' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#A8B0B8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#22272D' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#343A41' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#172633' }] },
];

function flagEmoji(countryCode: string | null | undefined) {
  const code = countryCode?.trim().toUpperCase();
  if (!code || !/^[A-Z]{2}$/.test(code)) return '✦';
  return code.split('').map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0))).join('');
}

export function ProfileEmptyState({ icon, title, action, onAction, theme, borderColor = theme.border }: { icon: keyof typeof Ionicons.glyphMap; title: string; action?: string; onAction?: () => void; theme: ProfileTheme; borderColor?: string }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={[styles.empty, { backgroundColor: resolvePresentationColor(theme.glass, 'backgroundColor', 'content'), borderColor }]}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={presentationBlurTint(theme.dark ? 'dark' : 'light')} style={StyleSheet.absoluteFill} /><Ionicons name={icon} size={24} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /><Text style={presentationTextStyle([styles.emptyText, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{title}</Text>{action && onAction ? <Pressable onPress={onAction} style={({ pressed }) => pressed && styles.pressed}><Text style={presentationTextStyle([styles.emptyAction, { color: resolvePresentationColor(theme.accent, 'color', 'content') }])}>{action}</Text></Pressable> : null}</View>;
}

export function VisitedPlacesMap({ journeys, countryCount, loading = false, theme, onPress, onCreate }: { journeys: ProfileJourney[]; countryCount: number; loading?: boolean; theme: ProfileTheme; onPress: () => void; onCreate: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const mapRef = useRef<MapView>(null);
  const markers = useMemo(() => journeys.flatMap((journey) => {
    const latitude = Number(journey.latitude); const longitude = Number(journey.longitude);
    return journey.latitude !== null && journey.longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) ? [{ id: journey.id, title: journey.destination, latitude, longitude }] : [];
  }), [journeys]);
  const region = useMemo(() => {
    if (!markers.length) return { latitude: 20, longitude: 0, latitudeDelta: 120, longitudeDelta: 160 };
    if (markers.length === 1) return { ...markers[0], latitudeDelta: 7, longitudeDelta: 7 };
    const latitudes = markers.map(({ latitude }) => latitude); const longitudes = markers.map(({ longitude }) => longitude);
    const minLatitude = Math.min(...latitudes); const maxLatitude = Math.max(...latitudes);
    const minLongitude = Math.min(...longitudes); const maxLongitude = Math.max(...longitudes);
    return { latitude: (minLatitude + maxLatitude) / 2, longitude: (minLongitude + maxLongitude) / 2, latitudeDelta: Math.max(4, (maxLatitude - minLatitude) * 1.65), longitudeDelta: Math.max(4, (maxLongitude - minLongitude) * 1.65) };
  }, [markers]);
  const primary = journeys[0];
  if (loading && !journeys.length) return <View style={[styles.mapSkeleton, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}><ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /></View>;
  if (!journeys.length) return <ProfileEmptyState icon="map-outline" title="Your travel map begins with your first journey." action="Create your first journey" onAction={onCreate} theme={theme} />;
  return <Pressable accessibilityRole="button" accessibilityLabel="Open your journey map" onPress={onPress} style={({ pressed }) => [styles.mapCard, { borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }, pressed && styles.pressed]}>
    <MapView ref={mapRef} pointerEvents="none" style={StyleSheet.absoluteFill} initialRegion={region} customMapStyle={theme.dark ? darkMapStyle : mapStyle} toolbarEnabled={false} pitchEnabled={false} rotateEnabled={false} scrollEnabled={false} zoomEnabled={false} onMapReady={() => mapRef.current?.animateToRegion(region, 0)} userInterfaceStyle={presentationInterfaceStyle()}>{markers.map((marker) => <Marker key={marker.id} coordinate={marker} title={marker.title} pinColor="#0A84FF" />)}</MapView>
    <View style={[styles.mapInfo, { backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.20)' : 'rgba(255,255,255,0.72)', 'borderColor', 'content') }]}>
      <BlurView pointerEvents="none" intensity={theme.dark ? 38 : 30} tint={presentationBlurTint(theme.dark ? 'dark' : 'light')} style={StyleSheet.absoluteFill} />
      <Text style={presentationTextStyle(styles.flag)}>{flagEmoji(primary?.place?.country_code)}</Text>
      <View style={styles.mapCopy}><Text numberOfLines={1} style={presentationTextStyle([styles.country, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{primary?.country || 'Your world'}</Text><Text style={presentationTextStyle([styles.mapCount, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{countryCount} {countryCount === 1 ? 'country' : 'countries'} visited</Text></View>
      <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.muted, 'color', 'content')} />
    </View>
  </Pressable>;
}

function AlbumLayer({ source, label, fallbackColor, theme, front = false }: { source: string | null; label: string; fallbackColor: string; theme: ProfileTheme; front?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const coverUrl = useMemo(() => resolveApiImageUrl(source, label), [label, source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showCover = Boolean(coverUrl && failedUrl !== coverUrl);
  return <View style={[styles.layerSurface, { backgroundColor: resolvePresentationColor(fallbackColor, 'backgroundColor', 'surface'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }]}>
    {front && !showCover ? <Ionicons name="albums-outline" size={30} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null}
    {showCover ? <Image source={cachedImageSource(coverUrl!, label)} style={styles.albumImage} contentFit="cover" cachePolicy="disk" recyclingKey={label} transition={220} onError={(response) => { setFailedUrl(coverUrl); if (__DEV__) console.warn('[Profile album image] onError', { url: coverUrl, response }); }} /> : null}
  </View>;
}

export function albumDates(journey: Pick<ProfileJourney, 'start_date' | 'end_date'>): string {
  const format = (value: string) => {
    if (!value) return '';
    const date = new Date(value.slice(0, 10) + 'T12:00:00');
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };
  const start = format(journey.start_date);
  const end = format(journey.end_date);
  return start && end && start !== end ? `${start} – ${end}` : start || end;
}

export function JourneyAlbumCard({ journey, theme, date, loading = false, reduceMotion = false, index = 0, fullWidth = false, photographic = false, onPress }: { journey: ProfileJourney; theme: ProfileTheme; date: string; loading?: boolean; reduceMotion?: boolean; index?: number; fullWidth?: boolean; photographic?: boolean; onPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const photoMedia = journey.media.filter((item) => item.type === 'photo');
  const photos = photoMedia.map((item) => item.thumbnail_url ?? item.url);
  const primary = journey.cover_media_url ?? photos[0] ?? null;
  const supporting = photoMedia.filter((item) => item.id !== journey.cover_media_id).map((item) => item.thumbnail_url ?? item.url).slice(0, 2);
  const pressProgress = useSharedValue(0);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: reduceMotion ? 1 : 1 - pressProgress.value * 0.03 }], opacity: 1 - pressProgress.value * 0.06 }));
  const middleStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 0 : pressProgress.value * 2 }] }));
  const farStyle = useAnimatedStyle(() => ({ transform: [{ translateX: reduceMotion ? 0 : pressProgress.value * 3 }] }));
  const pressIn = () => { pressProgress.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.cubic) }); };
  const pressOut = () => { pressProgress.value = withSpring(0, { damping: 20, stiffness: 280, mass: 0.65 }); };
  const albumEntrance = () => {
    'worklet';
    const delay = 300 + Math.min(index, 6) * 40;
    const timing = { duration: 330, easing: Easing.out(Easing.cubic) };
    return {
      initialValues: { opacity: 0, transform: [{ translateY: 10 }, { scale: 0.985 }] },
      animations: {
        opacity: withDelay(delay, withTiming(1, timing)),
        transform: [
          { translateY: withDelay(delay, withTiming(0, timing)) },
          { scale: withDelay(delay, withTiming(1, timing)) },
        ],
      },
    };
  };
  if (photographic) return <Animated.View entering={reduceMotion ? FadeIn.duration(120) : albumEntrance} style={[styles.photoCard, cardStyle]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${journey.title}`} onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} style={styles.photoCardPressable}>
      <AlbumLayer source={primary} label={`journey.album.cover:${journey.id}`} fallbackColor={theme.placeholder} theme={theme} />
      <LinearGradient pointerEvents="none" colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,0.68)'], 'colors', 'content')} locations={[0.35, 1]} style={StyleSheet.absoluteFill} />
      <View pointerEvents="none" style={styles.photoCaption}>
        <View style={styles.photoDestination}><Ionicons name="location-sharp" size={16} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /><Text numberOfLines={1} style={presentationTextStyle(styles.photoDestinationText)}>{journey.destination || journey.country || journey.title}</Text></View>
        <Text numberOfLines={1} style={presentationTextStyle(styles.photoDate)}>{profileRelativeDate(journey.created_at)}</Text>
      </View>
    </Pressable>
  </Animated.View>;
  return <Animated.View entering={reduceMotion ? FadeIn.duration(120) : albumEntrance} style={[styles.album, fullWidth && { maxWidth: '100%' }, cardStyle]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${journey.title}`} onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} style={styles.albumPressable}>
    <View style={styles.albumStack}>
      <Animated.View style={[styles.farLayer, farStyle]}><AlbumLayer source={supporting[1] ?? null} label={`journey.album.third:${journey.id}`} fallbackColor={theme.dark ? '#292C31' : '#E8ECF0'} theme={theme} /></Animated.View>
      <Animated.View style={[styles.middleLayer, middleStyle]}><AlbumLayer source={supporting[0] ?? null} label={`journey.album.second:${journey.id}`} fallbackColor={theme.dark ? '#34383E' : '#F0F2F4'} theme={theme} /></Animated.View>
      <View style={styles.frontLayer}><AlbumLayer source={primary} label={`journey.album.cover:${journey.id}`} fallbackColor={theme.placeholder} theme={theme} front /></View>
      {loading && journey.media.length === 0 && !journey.cover_media_url ? <Animated.View exiting={FadeOut.duration(210)} style={[styles.albumSkeleton, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]} /> : null}
    </View>
    <Text numberOfLines={2} style={presentationTextStyle([styles.albumTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{journey.title || 'Untitled journey'}</Text>
    {date ? <Text numberOfLines={1} style={presentationTextStyle([styles.albumDate, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{date}</Text> : null}
    </Pressable>
  </Animated.View>;
}

export function FavoritePlaceCard({ theme }: { theme: ProfileTheme }) {
  return <ProfileEmptyState icon="heart-outline" title="Places you recommend will appear here." theme={theme} />;
}

export function TravelStatsCard({ journeys, totalMemories, theme }: { journeys: ProfileJourney[]; totalMemories: number; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  if (!journeys.length) return null;
  const totalDays = journeys.reduce((sum, journey) => sum + Math.max(1, Math.round((new Date(`${journey.end_date}T12:00:00`).getTime() - new Date(`${journey.start_date}T12:00:00`).getTime()) / 86400000) + 1), 0);
  const counts = journeys.reduce<Record<string, number>>((result, journey) => ({ ...result, [journey.country]: (result[journey.country] ?? 0) + 1 }), {});
  const mostVisited = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  const rows = [{ icon: 'calendar-outline' as const, label: 'Total travel days', value: String(totalDays) }, mostVisited ? { icon: 'flag-outline' as const, label: 'Most visited country', value: mostVisited } : null, journeys[0] ? { icon: 'time-outline' as const, label: 'Latest journey', value: journeys[0].title } : null, { icon: 'book-outline' as const, label: 'Total memories', value: String(totalMemories) }].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[];
  return <View style={[styles.statsCard, { backgroundColor: resolvePresentationColor(theme.glass, 'backgroundColor', 'surface'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }]}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={presentationBlurTint(theme.dark ? 'dark' : 'light')} style={StyleSheet.absoluteFill} />{rows.map((row, index) => <View key={row.label} style={[styles.statsRow, index > 0 && { borderTopColor: resolvePresentationColor(theme.divider, 'borderTopColor', 'surface'), borderTopWidth: StyleSheet.hairlineWidth }]}><Ionicons name={row.icon} size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle([styles.statsLabel, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{row.label}</Text><Text numberOfLines={1} style={presentationTextStyle([styles.statsValue, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{row.value}</Text></View>)}</View>;
}

export function profileRelativeDate(value: string, now = Date.now()): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const days = Math.max(0, Math.floor((now - timestamp) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  photoCard: { flex: 1, minWidth: 0, marginBottom: 12 },
  photoCardPressable: { aspectRatio: 1.4, borderRadius: 22, overflow: 'hidden' },
  photoCaption: { position: 'absolute', bottom: 11, left: 11, right: 10 },
  photoDestination: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  photoDestinationText: { flex: 1, color: '#FFFFFF', fontSize: 15, lineHeight: 19, fontWeight: '600' },
  photoDate: { color: 'rgba(255,255,255,0.88)', fontSize: 12, lineHeight: 16, marginTop: 3, marginLeft: 20 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.992 }] },
  empty: { marginHorizontal: 20, minHeight: 120, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  emptyAction: { fontSize: 14, lineHeight: 20, fontWeight: '600', marginTop: 7 },
  mapCard: { aspectRatio: 2, marginHorizontal: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', justifyContent: 'flex-end', padding: 12 },
  mapSkeleton: { aspectRatio: 2, marginHorizontal: 20, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  mapInfo: { minHeight: 58, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  flag: { fontSize: 25 },
  mapCopy: { flex: 1, minWidth: 0 },
  country: { fontSize: 15, lineHeight: 19, fontWeight: '700', letterSpacing: -0.25 },
  mapCount: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  album: { flex: 1, minWidth: 0, maxWidth: '48%', marginBottom: 23 },
  albumPressable: { flex: 1 },
  albumStack: { width: '100%', aspectRatio: 0.88, marginBottom: 10, overflow: 'visible' },
  farLayer: { position: 'absolute', top: 10, right: 0, bottom: 0, left: 12, zIndex: 1, opacity: 0.84 },
  middleLayer: { position: 'absolute', top: 5, right: 6, bottom: 5, left: 6, zIndex: 2, opacity: 0.92 },
  frontLayer: { position: 'absolute', top: 0, right: 12, bottom: 10, left: 0, zIndex: 3 },
  layerSurface: { flex: 1, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  albumImage: { width: '100%', height: '100%' },
  albumSkeleton: { position: 'absolute', top: 0, right: 14, bottom: 10, left: 0, zIndex: 4, borderRadius: 22, opacity: 0.72 },
  albumTitle: { minHeight: 21, fontSize: 16, lineHeight: 20, fontWeight: '600', letterSpacing: -0.3, paddingRight: 5 },
  albumDate: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  statsCard: { marginHorizontal: 20, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  statsRow: { minHeight: 54, marginHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statsLabel: { flex: 1, fontSize: 13 },
  statsValue: { maxWidth: '47%', fontSize: 13, fontWeight: '600', textAlign: 'right' },
});
const presentationBaselineStyles = styles;

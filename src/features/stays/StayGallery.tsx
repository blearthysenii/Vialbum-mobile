import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { PublicPhotoViewer } from '@/features/discover/components/PublicPhotoViewer';
import type { PublicPhoto } from '@/features/discover/types';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { ProfileTheme } from '@/features/profile/theme';
import type { StayPhoto } from './api';
import { postMediaShape } from '@/features/posts/mediaShape';
import { GlassBackdrop, GlassButton } from './StayGlass';
function Photo({ photo, number, theme, onPress, onRetry }: { photo: PublicPhoto; number: number; theme: ProfileTheme; onPress: () => void; onRetry: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  const reduced = useReducedMotion();
  return <Pressable accessibilityRole="button" accessibilityLabel={failed ? 'Retry stay photo' : `Open stay photo ${number}`} onPress={failed ? onRetry : onPress} style={({ pressed }) => [{ flex: 1, backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control') }, pressed && { opacity: .9 }]}><Image source={cachedImageSource(photo.url, `stay-photo:${photo.id}`)} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={reduced ? 0 : 120} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />{loading ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} style={StyleSheet.absoluteFill} /> : null}{failed ? <View style={styles.fallback}><Ionicons name="image-outline" size={25} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), marginTop: 8 })}>Tap to retry</Text></View> : null}</Pressable>;
}
export function StayGallery({ photos = [], theme, onRetry, flush = false, onMenu, postCorners = false, countInteractive = false }: { photos?: StayPhoto[]; fallbackUrl?: string | null; city?: string | null; theme: ProfileTheme; onRetry: () => void; flush?: boolean; onMenu?: () => void; postCorners?: boolean; countInteractive?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [viewer, setViewer] = useState<PublicPhoto | null>(null);
  const publicPhotos = useMemo<PublicPhoto[]>(() => {
    const images = photos;
    return images.map(photo => ({ ...photo, caption: null, memory_id: null, thumbnail_url: null, width: null, height: null, captured_at: null, created_at: '', latitude: null, longitude: null, place: null }));
  }, [photos]);
  if (!publicPhotos.length) return null;
  const tile = (photo: PublicPhoto) => <Photo key={`${photo.id}:${photo.url}`} photo={photo} number={publicPhotos.indexOf(photo) + 1} theme={theme} onRetry={onRetry} onPress={() => setViewer(photo)} />;
  return <><View style={[styles.stage, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }, postCorners ? postMediaShape : { borderRadius: flush ? 0 : 24 }]}><View style={styles.collage}><View style={{ flex: publicPhotos.length > 1 ? 2 : 1 }}>{tile(publicPhotos[0])}</View>{publicPhotos.length > 1 ? <View style={styles.secondary}>{publicPhotos.slice(1).map(tile)}</View> : null}</View>{publicPhotos.length ? countInteractive ? <GlassButton label={`Open ${publicPhotos.length} stay photos`} theme={theme} media radius={16} onPress={() => setViewer(publicPhotos[0])} style={styles.count}><Ionicons name="camera-outline" size={12} color={resolvePresentationColor("#fff", 'color', 'content')} /><Text style={presentationTextStyle(styles.countText)}>{publicPhotos.length === 1 ? '1 photo' : `${publicPhotos.length} photos`}</Text></GlassButton> : <View pointerEvents="none" style={styles.count}><GlassBackdrop theme={theme} radius={16} media /><Ionicons name="camera-outline" size={12} color={resolvePresentationColor("#fff", 'color', 'content')} /><Text style={presentationTextStyle(styles.countText)}>{publicPhotos.length === 1 ? '1 photo' : `${publicPhotos.length} photos`}</Text></View> : null}{onMenu ? <GlassButton label="Stay options" theme={theme} media onPress={onMenu} style={styles.menu}><Ionicons name="ellipsis-horizontal" size={20} color={resolvePresentationColor("#fff", 'color', 'content')} /></GlassButton> : null}</View><PublicPhotoViewer photos={publicPhotos} photo={viewer} onClose={() => setViewer(null)} onPhotoChange={setViewer} /></>;
}
const styles = StyleSheet.create({ stage: { aspectRatio: 1.32, overflow: 'hidden' }, collage: { flex: 1, flexDirection: 'row', gap: 3 }, secondary: { flex: 1, gap: 3 }, fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14 }, count: { position: 'absolute', bottom: 14, left: 14, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 16, overflow: 'hidden' }, countText: { color: '#fff', fontSize: 11, fontWeight: '600' }, menu: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } });
const presentationBaselineStyles = styles;

import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { spacing } from '@/theme/spacing';
import { postMediaShape } from '@/features/posts/mediaShape';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ProfileAvatarImage } from '@/features/profile/components/ProfileAvatarImage';
import type { ProfileTheme } from '@/features/profile/theme';
import { postTarget } from '@/features/posts/data';
import { accommodationTypes, bookedVia, stayCategory, type Stay, type StayTip } from './api';
import { StayGallery } from './StayGallery';
import { GlassButton } from './StayGlass';
// Derive quieter materials from the current semantic foreground/accent colors.
function tone(color: string, alpha: number) {
  const hex = color.replace('#', '');
  if (!/^[a-f0-9]{6}$/i.test(hex)) return 'transparent';
  return `rgba(${parseInt(hex.slice(0, 2), 16)},${parseInt(hex.slice(2, 4), 16)},${parseInt(hex.slice(4, 6), 16)},${alpha})`;
}
export function stayContext(tip: StayTip) {
  const month = tip.journey.month;
  const date = month && /^\d{4}-\d{2}$/.test(month) ? new Date(`${month}-01T12:00:00Z`) : null;
  return [tip.journey.destination, date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : null].filter(Boolean).join(' · ');
}
export function BookingChip({ source, theme }: { source: Stay['booking_source']; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const label = bookedVia(source);
  return label ? <View style={[styles.chip, { backgroundColor: resolvePresentationColor(tone(theme.ink, theme.dark ? .045 : .03), 'backgroundColor', 'control') }]}><Ionicons name="calendar-outline" size={12} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, flexShrink: 1 })}>{label}</Text></View> : null;
}
export function StayMetadata({ stay, theme }: { stay: Stay; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const location = [stay.location?.name ?? stay.city, stay.location?.country ?? stay.place?.country].filter(Boolean).join(', ');
  return <View style={styles.metadata}><View style={styles.metaItem}><Ionicons name="location-outline" size={14} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text numberOfLines={2} style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, flexShrink: 1 })}>{location || 'Location not shared'}</Text></View><View style={styles.metaItem}><Ionicons name="bed-outline" size={15} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13, flexShrink: 1 })}>{stay.accommodation_type ? accommodationTypes[stay.accommodation_type] : stayCategory(stay.category)}</Text></View></View>;
}
export function RecommendationText({ text, theme }: { text?: string | null; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const long = text.length > 200;
  return <View style={styles.note}><Text numberOfLines={long && !expanded ? 4 : undefined} style={presentationTextStyle([styles.tip, { color: resolvePresentationColor(tone(theme.ink, theme.dark ? .9 : .8), 'color', 'content') }])}>“{text}”</Text>{long ? <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 32, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 13 })}>{expanded ? 'less' : 'more'}</Text></Pressable> : null}</View>;
}
export function Recommender({ tip, theme }: { tip: StayTip; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const profile = () => router.push({ pathname: '/public-profile/[id]', params: { id: tip.creator.id } });
  return <View style={styles.recommender}><Pressable accessibilityRole="button" accessibilityLabel={`View ${tip.creator.display_name}'s profile`} onPress={profile}><ProfileAvatarImage source={tip.creator.avatar_url} label={tip.creator.display_name} cacheKey={`stay-avatar:${tip.creator.id}`} fallbackIconSize={16} style={styles.avatar} /></Pressable><View style={{ flex: 1 }}><Pressable accessibilityRole="button" accessibilityLabel={`View ${tip.creator.display_name}'s profile`} onPress={profile}><Text numberOfLines={1} style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 14, fontWeight: '600' })}>{tip.creator.display_name}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="View journey" onPress={() => router.push(postTarget(tip.journey.id, tip.own))}><Text numberOfLines={2} style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12, marginTop: 3 })}>{stayContext(tip)}</Text></Pressable></View></View>;
}
export function StayCard({ stay, theme, onOpen, onMap, onMenu, onRetry }: { stay: Stay; theme: ProfileTheme; onOpen: () => void; onMap?: () => void; onMenu?: () => void; onRetry: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const reduced = useReducedMotion(), tip = stay.tips[0], hasPhotos = Boolean(stay.photos?.length);
  return <View style={[styles.cardFrame, { backgroundColor: resolvePresentationColor(theme.dark ? 'transparent' : theme.elevatedSurface, 'backgroundColor', 'surface') }, !theme.dark && styles.lightElevation, !theme.dark && { shadowColor: theme.ink }]}><View style={[styles.card, { backgroundColor: resolvePresentationColor(theme.dark ? theme.glass : theme.elevatedSurface, 'backgroundColor', 'surface') }]}>{hasPhotos ? <StayGallery photos={stay.photos} fallbackUrl={stay.cover_url} city={stay.city} theme={theme} flush onRetry={onRetry} onMenu={onMenu} /> : null}<View style={[styles.body, !hasPhotos && styles.textBody]}>{!hasPhotos && onMenu ? <View style={styles.textMenuRow}><GlassButton label="Stay options" theme={theme} onPress={onMenu} style={styles.textMenu}><Ionicons name="ellipsis-horizontal" size={20} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></GlassButton></View> : null}<Pressable accessibilityRole="button" accessibilityLabel={`View ${stay.name}`} onPress={onOpen} style={({ pressed }) => [{ opacity: pressed ? .85 : 1, transform: [{ scale: pressed && !reduced ? .99 : 1 }] }]}><Text style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{stay.name}</Text><StayMetadata stay={stay} theme={theme} /></Pressable><View style={bookedVia(stay.booking_source) ? styles.bookingSpace : undefined}><BookingChip source={stay.booking_source} theme={theme} /></View><RecommendationText text={tip?.tip} theme={theme} /><View style={styles.footer}>{tip ? <Recommender tip={tip} theme={theme} /> : <View style={{ flex: 1 }} />}{onMap ? <GlassButton label={`View ${stay.name} on map`} theme={theme} accent onPress={onMap} style={styles.mapAction}><Ionicons name="map-outline" size={14} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 12, fontWeight: '600', flexShrink: 1 })}>View map</Text><Ionicons name="chevron-forward" size={11} color={resolvePresentationColor(theme.accent, 'color', 'content')} /></GlassButton> : null}</View>{tip?.published === false ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12 })}>Draft · Not shared yet</Text> : null}</View><View pointerEvents="none" style={[StyleSheet.absoluteFill, postMediaShape, { borderWidth: theme.dark ? StyleSheet.hairlineWidth : 1, borderColor: resolvePresentationColor(tone(theme.ink, .075), 'borderColor', 'content') }]} /></View></View>;
}
const styles = StyleSheet.create({ cardFrame: { ...postMediaShape, marginBottom: 22 }, lightElevation: { shadowOpacity: .035, shadowRadius: 14, shadowOffset: { width: 0, height: 1 } }, card: { ...postMediaShape, overflow: 'hidden' }, body: { padding: spacing.md + spacing.xxs }, textBody: { paddingTop: spacing.lg }, textMenuRow: { alignItems: 'flex-end', marginBottom: spacing.xxs }, textMenu: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }, bookingSpace: { marginTop: spacing.sm + spacing.xxs }, note: { marginTop: spacing.md + spacing.xxs }, name: { fontSize: 22, fontWeight: '600', letterSpacing: -.3, lineHeight: 28 }, metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }, metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }, chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 6, maxWidth: '100%' }, tip: { fontSize: 16, lineHeight: 25, fontWeight: '400' }, footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.screen }, recommender: { flex: 1, minWidth: 110, flexDirection: 'row', alignItems: 'center', gap: 9 }, avatar: { width: 38, height: 38, borderRadius: 19 }, mapAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, borderRadius: 18, maxWidth: '100%' } });
const presentationBaselineStyles = styles;

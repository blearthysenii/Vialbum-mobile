import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { ProfileTheme } from '@/features/profile/theme';
import type { DiscoverJourney } from '../types';
import { discoverAspectRatio } from '../layout';
import { CreatorRow } from './CreatorRow';
import { SaveJourneyButton } from '@/features/savedJourneys/SaveJourneyButton';

export const DiscoverJourneyCard = memo(function DiscoverJourneyCard({ journey, theme, onOpen }: { journey: DiscoverJourney; theme: ProfileTheme; onOpen: (id: string) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[styles.card, animatedStyle]}><Pressable accessibilityRole="button" accessibilityLabel={`Explore ${journey.title} by ${journey.creator.username}`} onPress={() => onOpen(journey.id)} onPressIn={() => scale.set(withTiming(reduceMotion ? 1 : 0.98, { duration: 90 }))} onPressOut={() => scale.set(withTiming(1, { duration: 140 }))}>
    <View style={[styles.cover, { aspectRatio: discoverAspectRatio(journey), backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>
      {journey.cover_media_url ? <Image source={cachedImageSource(journey.cover_media_url, `discover:${journey.id}`)} recyclingKey={journey.id} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="memory-disk" transition={160} /> : <View style={styles.fallback}><Ionicons name="compass-outline" size={32} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /><Text style={presentationTextStyle([styles.fallbackCountry, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{journey.country}</Text></View>}
      <LinearGradient pointerEvents="none" colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,0.22)', 'rgba(0,0,0,0.78)'], 'colors', 'content')} locations={[0, 0.35, 1]} style={styles.gradient} />
      <View style={styles.save}><SaveJourneyButton journey={journey} overlay /></View>
      <View style={styles.copy}>
        <Text numberOfLines={2} style={presentationTextStyle(styles.title)}>{journey.title}</Text>
        <Text numberOfLines={1} style={presentationTextStyle(styles.place)}>{journey.country || journey.destination}</Text>
        <CreatorRow creator={journey.creator} theme={theme} overlay />
      </View>
      {theme.dark ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.cover, styles.darkEdge]} /> : null}
    </View>
  </Pressable></Animated.View>;
});
const styles = StyleSheet.create({
  card: { marginHorizontal: 5, marginBottom: 11 },
  save: { position: 'absolute', top: 6, right: 6, zIndex: 2 },
  cover: { width: '100%', borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' },
  darkEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)', zIndex: 3 },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 14 },
  fallbackCountry: { fontSize: 13, textAlign: 'center' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  copy: { position: 'absolute', left: 12, right: 12, bottom: 13 },
  title: { color: '#FFFFFF', fontSize: 20, lineHeight: 24, fontWeight: '600', letterSpacing: -0.5 },
  place: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18, marginTop: 3 },
});
const presentationBaselineStyles = styles;

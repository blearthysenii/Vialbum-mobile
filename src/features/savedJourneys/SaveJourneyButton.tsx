import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import type { DiscoverJourney } from '@/features/discover/types';
import { useProfileTheme } from '@/features/profile/theme';
import { useSavedJourneys } from './useSavedJourneys';

export function SaveJourneyButton({ journey, overlay = false }: { journey: Pick<DiscoverJourney, 'id' | 'creator' | 'is_saved'>; overlay?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { entries, toggle, userId } = useSavedJourneys();
  const theme = useProfileTheme();
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const state = entries.get(journey.id);
  const saved = state?.saved ?? journey.is_saved ?? false;
  if (!userId || journey.creator.id === userId) return null;
  return <View style={styles.wrap}>
    <Animated.View style={motion}>
      <Pressable accessibilityRole="button" accessibilityLabel={saved ? 'Remove from Saved' : 'Save journey'} accessibilityState={{ selected: saved, disabled: state?.pending ?? false, busy: state?.pending ?? false }} disabled={state?.pending}
        onPress={(event) => { event.stopPropagation(); void toggle(journey.id, journey.is_saved ?? false); }}
        onPressIn={() => scale.set(withTiming(reduceMotion ? 1 : 0.88, { duration: 90 }))}
        onPressOut={() => scale.set(withTiming(1, { duration: 130 }))}
        style={[styles.button, { backgroundColor: resolvePresentationColor(overlay ? 'rgba(0,0,0,0.35)' : theme.glassStrong, 'backgroundColor', 'control') }]}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={21} color={resolvePresentationColor(overlay ? '#FFFFFF' : theme.ink, 'color', 'content')} />
      </Pressable>
    </Animated.View>
    {state?.error ? <Text accessibilityRole="alert" style={presentationTextStyle([styles.error, { color: resolvePresentationColor(overlay ? '#FFFFFF' : theme.danger, 'color', 'content'), backgroundColor: resolvePresentationColor(overlay ? 'rgba(0,0,0,0.8)' : theme.canvas, 'backgroundColor', 'content') }])}>{state.error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', zIndex: 2 }, button: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  error: { position: 'absolute', top: 46, right: 0, width: 135, padding: 8, borderRadius: 10, fontSize: 11, lineHeight: 15 },
});
const presentationBaselineStyles = styles;

import { usePresentationStyles, resolvePresentationColor } from '@/theme/presentation';
import { StyleSheet } from 'react-native';
import Svg, { G, Line } from 'react-native-svg';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedReaction, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';

export enum RefreshPhase { IDLE, PULLING, ARMED, REFRESHING, COMPLETING }
const AnimatedLine = Animated.createAnimatedComponent(Line);
function Spoke({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const animatedProps = useAnimatedProps(() => ({
    strokeOpacity: Math.min(1, Math.max(0, progress.value * 12 - index)) * (.55 + index / 11 * .45),
  }));
  // A half-point light edge separates charcoal from dark photography without
  // a surface or luminance sampling. Both strokes share the exact reveal.
  const geometry = { x1: 12, y1: 2.2, x2: 12, y2: 6, rotation: index * 30, origin: '12, 12', strokeLinecap: 'round' as const };
  return <G><AnimatedLine {...geometry} animatedProps={animatedProps} stroke={resolvePresentationColor("#FFFFFF", 'stroke', 'content')} strokeWidth={2.8} opacity={.45} /><AnimatedLine {...geometry} animatedProps={animatedProps} stroke={resolvePresentationColor("#48484A", 'stroke', 'content')} strokeWidth={1.8} /></G>;
}

// Stable native strokes: only their animated opacity and angle change on pull.
export function ProfileSpinnerGlyph({ progress, phase, reduced }: { progress: SharedValue<number>; phase: SharedValue<RefreshPhase>; reduced: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const rotation = useSharedValue(0);
  useAnimatedReaction(() => phase.value, (next, previous) => {
    const spinning = next === RefreshPhase.ARMED || next === RefreshPhase.REFRESHING;
    const wasSpinning = previous === RefreshPhase.ARMED || previous === RefreshPhase.REFRESHING;
    if (spinning && !wasSpinning) {
      const start = rotation.value;
      rotation.set(withRepeat(withTiming(start + 360, { duration: 900, easing: Easing.linear }), -1, false));
    } else if (!spinning && wasSpinning) cancelAnimation(rotation);
  });
  useAnimatedReaction(() => ({ phase: phase.value, progress: progress.value }), value => {
    if (value.phase === RefreshPhase.PULLING || value.phase === RefreshPhase.IDLE) rotation.set(reduced ? 0 : value.progress * 240);
  });
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return <Animated.View style={[styles.glyph, style]}><Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>{Array.from({ length: 12 }, (_, index) => <Spoke key={index} index={index} progress={progress} />)}</Svg></Animated.View>;
}
const styles = StyleSheet.create({ glyph: { width: 24, height: 24 } });
const presentationBaselineStyles = styles;

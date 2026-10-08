import { usePresentationStyles, resolvePresentationColor, presentationBlurTint } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

export function PlaybackControls({ paused, muted, silent, onPlay, onMute }: {
  paused: boolean; muted: boolean; silent: boolean; onPlay: () => void; onMute: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const wasPaused = useRef(false);
  useEffect(() => {
    if (paused && !wasPaused.current) scale.setValue(0.88);
    wasPaused.current = paused;
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: paused ? 1 : 0, duration: paused ? 160 : 120, useNativeDriver: true }),
      paused ? Animated.spring(scale, { toValue: 1, damping: 24, stiffness: 300, mass: 0.65, overshootClamping: true, useNativeDriver: true })
        : Animated.timing(scale, { toValue: 0.94, duration: 120, useNativeDriver: true }),
    ]);
    animation.start(); return () => animation.stop();
  }, [paused, opacity, scale]);
  return <Animated.View pointerEvents={paused ? 'box-none' : 'none'} accessibilityElementsHidden={!paused}
    importantForAccessibility={paused ? 'auto' : 'no-hide-descendants'}
    style={[styles.controls, { opacity, transform: [{ scale }] }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={silent ? 'Video has no audio' : muted ? 'Unmute video' : 'Mute video'}
      accessibilityState={{ disabled: silent }} disabled={silent} onPress={onMute} style={[styles.circle, styles.sound]}>
      <BlurView pointerEvents="none" intensity={32} tint={presentationBlurTint("systemThinMaterialDark")} style={StyleSheet.absoluteFill} />
      <Ionicons name={muted || silent ? 'volume-mute-outline' : 'volume-high-outline'} size={24} color={resolvePresentationColor("white", 'color', 'content')} />
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Play video" onPress={onPlay} style={[styles.circle, styles.play]}>
      <BlurView pointerEvents="none" intensity={54} tint={presentationBlurTint("systemThinMaterialDark")} style={StyleSheet.absoluteFill} />
      <Ionicons name="play" size={34} color={resolvePresentationColor("white", 'color', 'content')} style={{ marginLeft: 3 }} />
    </Pressable>
  </Animated.View>;
}
const styles = StyleSheet.create({
  controls: { position: 'absolute', left: '50%', top: '50%', marginLeft: -42, marginTop: -114,
    width: 84, height: 156, alignItems: 'center', gap: 18 },
  circle: { overflow: 'hidden', backgroundColor: 'rgba(12,12,16,0.28)', alignItems: 'center', justifyContent: 'center' },
  sound: { width: 54, height: 54, borderRadius: 27 },
  play: { width: 84, height: 84, borderRadius: 42 },
});
const presentationBaselineStyles = styles;

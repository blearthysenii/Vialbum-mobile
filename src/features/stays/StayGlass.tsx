import { resolvePresentationColor, presentationBlurTint } from '@/theme/presentation';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import type { ProfileTheme } from '@/features/profile/theme';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
export function GlassBackdrop({ theme, radius, media = false, accent = false }: { theme: ProfileTheme; radius: number; media?: boolean; accent?: boolean }) {
  const dark = media || theme.dark;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden', backgroundColor: resolvePresentationColor(Platform.OS === 'ios' ? dark ? 'rgba(22,22,24,0.12)' : theme.glass : media ? 'rgba(22,22,24,0.72)' : theme.glassStrong, 'backgroundColor', 'content') }]}>
    {Platform.OS === 'ios' ? <BlurView pointerEvents="none" intensity={media ? 28 : 24} tint={presentationBlurTint(dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight')} style={StyleSheet.absoluteFill} /> : null}
    {accent ? <View style={[StyleSheet.absoluteFill, { backgroundColor: resolvePresentationColor(theme.accent, 'backgroundColor', 'content'), opacity: theme.dark ? .075 : .045 }]} /> : null}
    <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: resolvePresentationColor(dark ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.72)', 'borderColor', 'content') }]} />
  </View>;
}
export function GlassButton({ children, label, onPress, theme, style, radius = 18, media = false, accent = false, hitSlop = 4, disabled = false }: { children: ReactNode; label: string; onPress: () => void; theme: ProfileTheme; style?: StyleProp<ViewStyle>; radius?: number; media?: boolean; accent?: boolean; hitSlop?: number; disabled?: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  useEffect(() => () => scale.stopAnimation(), [scale]);
  const press = (value: number) => {
    if (reduced || disabled) return;
    Animated.timing(scale, { toValue: value, duration: value === 1 ? 120 : 90, useNativeDriver: true }).start();
  };
  return <AnimatedPressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} hitSlop={hitSlop} onPressIn={() => press(.97)} onPressOut={() => press(1)} onPress={() => { if (disabled) return; void Haptics.selectionAsync().catch(() => {}); onPress(); }} style={[style, { borderRadius: radius, overflow: 'hidden', opacity: disabled ? .45 : 1, transform: [{ scale }] }]}><GlassBackdrop theme={theme} radius={radius} media={media} accent={accent} />{children}</AnimatedPressable>;
}

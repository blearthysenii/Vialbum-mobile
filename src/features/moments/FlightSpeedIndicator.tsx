import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

export function FlightSpeedIndicator({ visible, top }: { visible: boolean; top: number }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const reduced = useReducedMotion();
  const motion = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) motion.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: visible ? 120 : 170, useNativeDriver: true }),
      Animated.timing(motion, { toValue: visible ? 1 : 0, duration: reduced ? 0 : visible ? 300 : 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start(); return () => animation.stop();
  }, [visible, reduced, motion, opacity]);
  return <Animated.View pointerEvents="none" accessibilityElementsHidden={!visible} style={[styles.position, { top, opacity, transform: [{ scale: reduced ? 1 : motion.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
    {!reduced ? <Animated.View style={[styles.trail, { opacity: motion.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.8, 0] }), transform: [{ scaleX: motion }] }]}><Svg width={30} height={16}><Path d="M2 12 Q12 2 28 8" stroke={resolvePresentationColor("white", 'stroke', 'content')} strokeWidth={1} strokeDasharray="2 5" fill={resolvePresentationColor("none", 'fill', 'content')} /></Svg></Animated.View> : null}
    <View style={styles.capsule}><BlurView intensity={64} tint={presentationBlurTint("systemThinMaterialDark")} style={StyleSheet.absoluteFill} />
      <Animated.View style={{ transform: [{ translateX: reduced ? 0 : motion.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }, { translateY: reduced ? 0 : motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [3, -1, 0] }) }] }}><Ionicons name="airplane" size={16} color={resolvePresentationColor("white", 'color', 'content')} /></Animated.View>
      <Animated.View style={{ opacity: reduced ? 1 : motion, transform: [{ translateX: reduced ? 0 : motion.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] }}><Text style={presentationTextStyle(styles.label)}>2×</Text></Animated.View>
    </View>
  </Animated.View>;
}
const styles = StyleSheet.create({ position: { position: 'absolute', right: 0, width: 56, alignItems: 'center' }, trail: { position: 'absolute', left: 4, top: 10 }, capsule: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, width: 56, height: 36, borderRadius: 24, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(12,12,16,0.25)' }, label: { color: 'white', fontSize: 14, fontWeight: '600' } });
const presentationBaselineStyles = styles;

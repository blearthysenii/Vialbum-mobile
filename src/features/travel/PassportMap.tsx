import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, G, Path } from 'react-native-svg';
import type { ProfileTheme } from '@/features/profile/theme';
import geometry from './worldGeometry.json';

type Props = {
  theme: ProfileTheme; visited: Set<string>; mode: 'countries' | 'continents';
  activeContinents: Set<string>; selectedContinent: string | null;
  onCountry: (code: string, name: string) => void; onContinent: (name: string) => void;
};
export const PassportMap = memo(function PassportMap({ theme, visited, mode, activeContinents, selectedContinent, onCountry, onContinent }: Props) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const scale = useSharedValue(1), savedScale = useSharedValue(1);
  const x = useSharedValue(0), y = useSharedValue(0), savedX = useSharedValue(0), savedY = useSharedValue(0);
  const width = useSharedValue(350), height = useSharedValue(260);
  const reducedMotion = useReducedMotion();
  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Pinch().onStart(() => { savedScale.value = scale.value; }).onUpdate(event => {
      scale.value = Math.max(1, Math.min(7, savedScale.value * event.scale));
      const limitX = width.value * (scale.value - 1) / 2, limitY = height.value * (scale.value - 1) / 2;
      x.value = Math.max(-limitX, Math.min(limitX, x.value));
      y.value = Math.max(-limitY, Math.min(limitY, y.value));
    }),
    Gesture.Pan().minDistance(8).onTouchesDown((_, manager) => { if (scale.value <= 1) manager.fail(); }).onStart(() => { savedX.value = x.value; savedY.value = y.value; }).onUpdate(event => {
      const limitX = width.value * (scale.value - 1) / 2, limitY = height.value * (scale.value - 1) / 2;
      x.value = Math.max(-limitX, Math.min(limitX, savedX.value + event.translationX));
      y.value = Math.max(-limitY, Math.min(limitY, savedY.value + event.translationY));
    }),
  ), [height, savedScale, savedX, savedY, scale, width, x, y]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }] }));
  const reset = () => {
    if (reducedMotion) { scale.value = 1; x.value = 0; y.value = 0; }
    else { scale.value = withSpring(1); x.value = withSpring(0); y.value = withSpring(0); }
  };
  const neutral = theme.dark ? '#30343C' : '#E0E4EA';
  const border = theme.dark ? '#11151C' : '#FFFFFF';
  return <View style={[styles.shell, { backgroundColor: resolvePresentationColor(theme.dark ? '#10141B' : '#F7F9FC', 'backgroundColor', 'content') }]}>
    <GestureDetector gesture={gesture}>
      <Animated.View onLayout={event => { width.value = event.nativeEvent.layout.width; height.value = event.nativeEvent.layout.height; }} style={styles.viewport}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 360 150" accessibilityLabel="Interactive world map. Pinch to zoom and drag to explore.">
            {geometry.map((country, index) => {
              const emphasized = mode === 'countries' ? visited.has(country.code) : selectedContinent ? country.continent === selectedContinent : activeContinents.has(country.continent);
              const fill = emphasized ? theme.accent : neutral;
              const select = () => mode === 'countries' ? onCountry(country.code, country.name) : onContinent(country.continent);
              return <G key={`${country.code}:${index}`}>
                <Path d={country.d} fill={resolvePresentationColor(fill, 'backgroundColor', 'surface')} stroke={resolvePresentationColor(border, 'stroke', 'content')} strokeWidth={mode === 'continents' ? 0.12 : 0.3} strokeLinejoin="round" onPress={select} accessibilityLabel={`${country.name}${visited.has(country.code) ? ', visited' : ''}`} />
                {/* A real point target keeps tiny countries selectable at this scale. */}
                {!country.d || (visited.has(country.code) && country.d.length < 180) ? <Circle cx={country.x} cy={country.y} r={1.1} fill={resolvePresentationColor(fill, 'backgroundColor', 'surface')} stroke={resolvePresentationColor(border, 'stroke', 'content')} strokeWidth={0.25} onPress={select} accessibilityLabel={country.name} /> : null}
              </G>;
            })}
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
    <View pointerEvents="box-none" style={styles.footer}>
      <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 11 })}>Pinch to explore</Text>
      <Pressable accessibilityLabel="Reset world map zoom" onPress={reset} hitSlop={10}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 12, fontWeight: '600' })}>Reset</Text></Pressable>
    </View>
  </View>;
});
const styles = StyleSheet.create({ shell: { borderRadius: 26, overflow: 'hidden' }, viewport: { height: 270, overflow: 'hidden' }, footer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 15 } });
const presentationBaselineStyles = styles;

import Ionicons from '@expo/vector-icons/Ionicons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { AuthThemeColors } from '@/features/auth/theme';

const ORBIT_ICONS = [
  'image-outline',
  'car-outline',
  'train-outline',
  'airplane-outline',
  'ticket-outline',
  'location-outline',
] as const;
type OrbitIcon = (typeof ORBIT_ICONS)[number];

function shuffledIcons(previousIcon?: OrbitIcon) {
  const shuffled = [...ORBIT_ICONS];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  if (previousIcon && shuffled[0] === previousIcon) {
    const replacementIndex = shuffled.findIndex((icon) => icon !== previousIcon);
    [shuffled[0], shuffled[replacementIndex]] = [shuffled[replacementIndex], shuffled[0]];
  }

  return shuffled;
}

const VORTEX_COLORS = ['#B65F3A', '#D9915D', '#E8C994', '#718C96', '#52788B', '#7F898E'] as const;
const DARK_VORTEX_COLORS = ['#D47A55', '#E5A372', '#F3D8A5', '#94ADB5', '#75A3B6', '#A4AEB2'] as const;
const VORTEX_LAYERS = [
  { count: 26, radius: 52, offset: 0.02, sizeBias: 0.15 },
  { count: 30, radius: 60, offset: 0.13, sizeBias: 0.45 },
  { count: 34, radius: 68, offset: 0.04, sizeBias: 0.75 },
  { count: 38, radius: 76, offset: 0.11, sizeBias: 1 },
] as const;
const ACTIVE_DOT_START_ANGLES = [-1.34, -0.42, 0.54, 1.72, 2.68, 3.74] as const;

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function colorForAngle(angle: number, palette: readonly string[]) {
  const normalized = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const position = normalized / (Math.PI * 2) * palette.length;
  const colorIndex = Math.floor(position) % palette.length;
  const nextColorIndex = (colorIndex + 1) % palette.length;
  const mix = position - Math.floor(position);
  const from = hexToRgb(palette[colorIndex]);
  const to = hexToRgb(palette[nextColorIndex]);
  const channel = (start: number, end: number) => Math.round(start + (end - start) * mix);

  return `rgb(${channel(from.r, to.r)}, ${channel(from.g, to.g)}, ${channel(from.b, to.b)})`;
}

const VORTEX_DOTS = VORTEX_LAYERS.map((layer, layerIndex) =>
  Array.from({ length: layer.count }, (_, dotIndex) => {
    const progress = dotIndex / layer.count;
    const angle = progress * Math.PI * 2 + layer.offset;
    const organicOffset = Math.sin(dotIndex * 2.17 + layerIndex * 1.31) * 0.9;
    const sizeWave = (Math.sin(dotIndex * 1.79 + layerIndex * 0.83) + 1) / 2;
    return {
      angle,
      orbitRadius: layer.radius + organicOffset,
      radius: 2.35 + sizeWave * 1.55 + layer.sizeBias * 0.45,
      color: colorForAngle(angle, VORTEX_COLORS),
      darkColor: colorForAngle(angle, DARK_VORTEX_COLORS),
      opacity: 0.82 + sizeWave * 0.18,
      pulseOffset: dotIndex * 0.73 + layerIndex,
    };
  }),
);

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type VortexParticleProps = {
  color: string;
  dot: (typeof VORTEX_DOTS)[number][number];
  layerIndex: number;
  iconCycle: SharedValue<number>;
  reduceMotion: boolean;
  vortexRotation: SharedValue<number>;
};

function VortexParticle({ color, dot, layerIndex, iconCycle, reduceMotion, vortexRotation }: VortexParticleProps) {
  const animatedProps = useAnimatedProps(() => {
    const phase = iconCycle.value - Math.floor(iconCycle.value);
    const cycleIndex = Math.floor(iconCycle.value) % ORBIT_ICONS.length;
    const startAngle = ACTIVE_DOT_START_ANGLES[cycleIndex];
    const travelProgress = Math.min(Math.max((phase - 0.1) / 0.75, 0), 1);
    const easedTravel = travelProgress * travelProgress * (3 - 2 * travelProgress);
    const iconAngle = reduceMotion ? startAngle : startAngle + easedTravel * Math.PI * 2;
    // Keep every row moving as one coherent Apple-like ring. Counter-rotating
    // rows make the silhouette look like random dust instead of a single band.
    const layerRotation = reduceMotion
      ? 0
      : vortexRotation.value * (1 + layerIndex * 0.012) * Math.PI / 180;
    const particleAngle = dot.angle + layerRotation;
    const signedDistance = Math.atan2(
      Math.sin(particleAngle - iconAngle),
      Math.cos(particleAngle - iconAngle),
    );
    const angularDistance = Math.abs(signedDistance);
    const outerFade = signedDistance >= 0 ? 0.56 : 0.46;
    const innerGap = 0.21;
    const gapPosition = Math.min(Math.max((angularDistance - innerGap) / (outerFade - innerGap), 0), 1);
    const smoothGapPosition = gapPosition * gapPosition * (3 - 2 * gapPosition);
    const gapOpen = Math.min(phase / 0.067, 1);
    const gapClose = Math.min((0.967 - phase) / 0.067, 1);
    const gapStrength = Math.max(0, Math.min(gapOpen, gapClose));
    const gapEffect = (1 - smoothGapPosition) * gapStrength;
    const pulse = reduceMotion ? 0 : Math.sin(vortexRotation.value * 0.045 + dot.pulseOffset) * 0.025;

    return {
      cx: 85 + Math.cos(particleAngle) * dot.orbitRadius,
      cy: 85 + Math.sin(particleAngle) * dot.orbitRadius,
      opacity: Math.max(0.01, dot.opacity * (1 - gapEffect * 0.99) + pulse),
      r: Math.max(0.08, dot.radius * (1 - gapEffect * 0.96)),
    };
  }, [layerIndex, reduceMotion]);

  return <AnimatedCircle animatedProps={animatedProps} fill={color} />;
}

export function AuthVortexMark({ authColors, isDark }: { authColors: AuthThemeColors; isDark: boolean }) {
  const reduceMotion = useReducedMotion();
  const iconOrder = useRef<OrbitIcon[] | null>(null);
  if (!iconOrder.current) iconOrder.current = shuffledIcons();
  const [activeIcon, setActiveIcon] = useState<OrbitIcon>(iconOrder.current[0]);
  const iconCycle = useSharedValue(0);
  const globeRotation = useSharedValue(0);
  const vortexRotation = useSharedValue(0);

  const updateActiveIcon = useCallback((slot: number, previousSlot: number | null) => {
    if (!iconOrder.current) return;

    if (slot === 0 && previousSlot === ORBIT_ICONS.length - 1) {
      const previousIcon = iconOrder.current[ORBIT_ICONS.length - 1];
      iconOrder.current = shuffledIcons(previousIcon);
    }

    setActiveIcon(iconOrder.current[slot]);
  }, []);

  useEffect(() => {
    iconCycle.value = withRepeat(withTiming(6, {
      duration: reduceMotion ? 13200 : 36000,
      easing: Easing.linear,
    }), -1, false);
    vortexRotation.value = reduceMotion
      ? 0
      : withRepeat(withTiming(360, { duration: 32000, easing: Easing.linear }), -1, false);
    globeRotation.value = reduceMotion
      ? 0
      : withRepeat(withTiming(-360, { duration: 20000, easing: Easing.linear }), -1, false);

    return () => {
      cancelAnimation(iconCycle);
      cancelAnimation(globeRotation);
      cancelAnimation(vortexRotation);
    };
  }, [globeRotation, iconCycle, reduceMotion, vortexRotation]);

  useAnimatedReaction(
    () => Math.floor(iconCycle.value) % ORBIT_ICONS.length,
    (nextIndex, previousIndex) => {
      if (nextIndex !== previousIndex) runOnJS(updateActiveIcon)(nextIndex, previousIndex);
    },
    [iconCycle, updateActiveIcon],
  );

  const iconAnimation = useAnimatedStyle(() => {
    const phase = iconCycle.value - Math.floor(iconCycle.value);
    const cycleIndex = Math.floor(iconCycle.value) % ORBIT_ICONS.length;
    const startAngle = ACTIVE_DOT_START_ANGLES[cycleIndex];
    const travelProgress = Math.min(Math.max((phase - 0.1) / 0.75, 0), 1);
    const easedTravel = travelProgress * travelProgress * (3 - 2 * travelProgress);
    const angle = reduceMotion
      ? startAngle
      : startAngle + easedTravel * Math.PI * 2;
    const frontDepth = (Math.sin(angle) + 1) / 2;
    const fadeInProgress = Math.min(Math.max((phase - 0.065) / 0.055, 0), 1);
    const fadeOutProgress = Math.min(Math.max((0.9 - phase) / 0.05, 0), 1);
    const visibilityProgress = Math.min(fadeInProgress, fadeOutProgress);
    const visibility = visibilityProgress * visibilityProgress * (3 - 2 * visibilityProgress);
    const depthScale = 0.94 + frontDepth * 0.08;
    const depthOpacity = 0.82 + frontDepth * 0.18;

    return {
      opacity: visibility * depthOpacity,
      zIndex: frontDepth > 0.5 ? 3 : 1,
      transform: [
        { translateX: Math.cos(angle) * 64 },
        { translateY: Math.sin(angle) * 64 },
        { scale: (0.72 + visibility * 0.28) * depthScale },
      ],
    };
  }, [reduceMotion]);

  const globeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${globeRotation.value}deg` }],
  }));

  return (
    <View accessibilityElementsHidden style={styles.mark}>
      {VORTEX_DOTS.map((dots, layerIndex) => (
        <View
          key={`vortex-layer-${layerIndex}`}
          pointerEvents="none"
          style={styles.markOrbit}
        >
          <Svg width={170} height={170} viewBox="0 0 170 170">
            {dots.map((dot, dotIndex) => (
              <VortexParticle
                key={`${layerIndex}-${dotIndex}`}
                color={isDark ? dot.darkColor : dot.color}
                dot={dot}
                iconCycle={iconCycle}
                layerIndex={layerIndex}
                reduceMotion={reduceMotion}
                vortexRotation={vortexRotation}
              />
            ))}
          </Svg>
        </View>
      ))}
      <Animated.View style={[styles.globeLayer, globeAnimatedStyle]}>
        <Image
          resizeMode="contain"
          source={require('../../../../assets/images/globe.png')}
          style={styles.globeImage}
        />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.orbitIcon, iconAnimation]}>
          <Ionicons name={activeIcon} size={22} color={authColors.accent} />
      </Animated.View>
    </View>
  );
}


const styles = StyleSheet.create({
  mark: { width: 126, height: 126, alignItems: 'center', justifyContent: 'center' },
  markOrbit: { position: 'absolute', left: -22, top: -22, width: 170, height: 170 },
  globeLayer: { zIndex: 2 },
  globeImage: { width: 55, height: 55, opacity: 0.78 },
  orbitIcon: { position: 'absolute', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
});

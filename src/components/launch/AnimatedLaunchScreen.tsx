import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import { useAuthTheme } from '@/features/auth/theme';
import { systemFont } from '@/theme/tokens';

const WORD = 'Vialbum';
const LETTER_DURATION = 250;
const LETTER_DELAY = 55;
const REVEAL_DURATION = LETTER_DURATION + LETTER_DELAY * (WORD.length - 1);
const HOLD_DURATION = 750;
const EXIT_DURATION = 340;

function LaunchLetter({
  index,
  letter,
  progress,
  reduceMotion,
  textColor,
}: {
  index: number;
  letter: string;
  progress: SharedValue<number>;
  reduceMotion: boolean;
  textColor: string;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const animatedStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return { opacity: progress.value, transform: [{ translateY: 0 }, { scale: 1 }] };
    }

    const elapsed = progress.value * REVEAL_DURATION;
    const localProgress = Math.min(Math.max((elapsed - index * LETTER_DELAY) / LETTER_DURATION, 0), 1);
    const eased = 1 - Math.pow(1 - localProgress, 3);

    return {
      opacity: eased,
      transform: [
        { translateY: (1 - eased) * 3 },
        { scale: 0.96 + eased * 0.04 },
      ],
    };
  }, [index, reduceMotion]);

  return (
    <Animated.Text accessible={false} style={presentationTextStyle([styles.letter, { color: resolvePresentationColor(textColor, 'color', 'content') }, animatedStyle])}>
      {letter}
    </Animated.Text>
  );
}

export function AnimatedLaunchScreen({ ready, onComplete }: { ready: boolean; onComplete: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { isDark, colors: authColors } = useAuthTheme();
  const themeStyles = useMemo(() => StyleSheet.create({
    screen: { backgroundColor: authColors.canvas },
    title: { color: authColors.title },
  }), [authColors]);
  const reduceMotion = useReducedMotion();
  const [introComplete, setIntroComplete] = useState(false);
  const exitStarted = useRef(false);
  const wordProgress = useSharedValue(0);
  const introGate = useSharedValue(0);
  const screenOpacity = useSharedValue(1);
  const screenScale = useSharedValue(1);

  useEffect(() => {
    const revealDuration = reduceMotion ? 180 : REVEAL_DURATION;
    wordProgress.value = withTiming(1, {
      duration: revealDuration,
      easing: reduceMotion ? Easing.out(Easing.cubic) : Easing.linear,
    });
    introGate.value = withDelay(
      revealDuration + HOLD_DURATION,
      withTiming(1, { duration: 1 }, (finished) => {
        if (finished) runOnJS(setIntroComplete)(true);
      }),
    );

    return () => {
      cancelAnimation(wordProgress);
      cancelAnimation(introGate);
    };
  }, [introGate, reduceMotion, wordProgress]);

  useEffect(() => {
    if (!ready || !introComplete || exitStarted.current) return;
    exitStarted.current = true;
    const duration = reduceMotion ? 180 : EXIT_DURATION;
    screenScale.value = withTiming(reduceMotion ? 1 : 1.025, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
    screenOpacity.value = withTiming(0, {
      duration,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) runOnJS(onComplete)();
    });

    return () => {
      cancelAnimation(screenOpacity);
      cancelAnimation(screenScale);
    };
  }, [introComplete, onComplete, ready, reduceMotion, screenOpacity, screenScale]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
    transform: [{ scale: screenScale.value }],
  }));

  return (
    <Animated.View
      accessibilityLabel="Vialbum"
      accessible
      shouldRasterizeIOS={false}
      style={[styles.screen, themeStyles.screen, screenStyle]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.wordFrame}>
        <Text accessible={false} style={presentationTextStyle([styles.title, themeStyles.title, styles.wordMeasure])}>Vialbum</Text>
        <View pointerEvents="none" style={styles.letters}>
          {WORD.split('').map((letter, index) => (
            <LaunchLetter
              key={`${letter}-${index}`}
              index={index}
              letter={letter}
              progress={wordProgress}
              reduceMotion={reduceMotion}
              textColor={authColors.title}
            />
          ))}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordFrame: { position: 'relative' },
  wordMeasure: { opacity: 0 },
  letters: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: systemFont,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  letter: {
    fontFamily: systemFont,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
});
const presentationBaselineStyles = styles;

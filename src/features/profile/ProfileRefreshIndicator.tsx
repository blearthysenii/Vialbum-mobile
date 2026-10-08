import { usePresentationStyles } from '@/theme/presentation';
import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useDerivedValue, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { ProfileTheme } from './theme';
import { ProfileSpinnerGlyph, RefreshPhase } from './ProfileSpinnerGlyph';

export function useProfilePull({ resetKey, refreshing, topInset, heroHeight, onScrollState, onReleaseRefresh, onEndReached }: { resetKey?: string; onEndReached?: () => void; onReleaseRefresh?: () => void; refreshing: boolean; topInset: number; heroHeight: number; theme: ProfileTheme; onScrollState: (collapsed: boolean, overPhoto: boolean) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const reduced = useReducedMotion();
  const phase = useSharedValue(RefreshPhase.IDLE);
  const pull = useSharedValue(0), progress = useSharedValue(0);
  const dragging = useSharedValue(false);
  const hapticSent = useSharedValue(false);
  const scrollOffset = useSharedValue(0);
  const nearEnd = useSharedValue(false);
  const previous = useSharedValue(0), collapsed = useSharedValue(false), overPhoto = useSharedValue(true);
  const pendingNative = useRef<(() => void) | null>(null);
  const claimed = useRef(false);
  useEffect(() => {
    // Session identity changes must also discard the previous account's native
    // gesture/hero offset; collection changes deliberately do not reset it.
    cancelAnimation(progress);
    phase.set(RefreshPhase.IDLE); pull.set(0); progress.set(0);
    dragging.set(false); hapticSent.set(false); scrollOffset.set(0);
    nearEnd.set(false); previous.set(0); collapsed.set(false); overPhoto.set(true);
    pendingNative.current = null; claimed.current = false;
  }, [resetKey, phase, pull, progress, dragging, hapticSent, scrollOffset, nearEnd, previous, collapsed, overPhoto]);
  const requestRefresh = useCallback((action: () => void) => {
    if (claimed.current) return;
    if (dragging.value) { pendingNative.current = action; return; }
    if (phase.value === RefreshPhase.REFRESHING) { claimed.current = true; action(); }
  }, [dragging, phase]);
  const releaseRefresh = useCallback((eligible: boolean) => {
    const action = pendingNative.current ?? onReleaseRefresh;
    pendingNative.current = null;
    if (eligible && action && !claimed.current) { claimed.current = true; action(); }
  }, [onReleaseRefresh]);
  const resetGesture = useCallback(() => { claimed.current = false; pendingNative.current = null; }, []);
  const haptic = useCallback(() => { void Haptics.selectionAsync().catch(() => undefined); }, []);
  const complete = () => {
    'worklet';
    phase.set(RefreshPhase.COMPLETING);
    progress.set(withTiming(0, { duration: reduced ? 0 : 200 }, finished => {
      if (finished && phase.value === RefreshPhase.COMPLETING) phase.set(RefreshPhase.IDLE);
    }));
  };
  useEffect(() => {
    if (refreshing) {
      phase.set(RefreshPhase.REFRESHING);
      progress.set(withTiming(1, { duration: reduced ? 0 : 120 }));
    } else if (phase.value === RefreshPhase.REFRESHING) {
      phase.set(RefreshPhase.COMPLETING);
      progress.set(withTiming(0, { duration: reduced ? 0 : 200 }, finished => {
        if (finished && phase.value === RefreshPhase.COMPLETING) phase.set(RefreshPhase.IDLE);
      }));
    }
  }, [refreshing, reduced, phase, progress]);
  useEffect(() => () => { cancelAnimation(progress); }, [progress]);
  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      dragging.set(true);
      if (phase.value !== RefreshPhase.REFRESHING) {
        cancelAnimation(progress); hapticSent.set(false);
        phase.set(RefreshPhase.PULLING); runOnJS(resetGesture)();
      }
    },
    onEndDrag: () => {
      dragging.set(false);
      if (phase.value === RefreshPhase.ARMED) {
        phase.set(RefreshPhase.REFRESHING);
        runOnJS(releaseRefresh)(true);
      } else if (phase.value === RefreshPhase.PULLING) {
        runOnJS(releaseRefresh)(false); complete();
      }
    },
    onScroll: event => {
    const y = event.contentOffset.y;
    scrollOffset.set(y);
    pull.set(Math.max(0, -y));
    if (dragging.value && (phase.value === RefreshPhase.PULLING || phase.value === RefreshPhase.ARMED)) {
      const next = Math.min(1, pull.value / 80);
      progress.set(next);
      if (next >= 1 && phase.value !== RefreshPhase.ARMED) {
        phase.set(RefreshPhase.ARMED);
        if (!hapticSent.value) { hapticSent.set(true); runOnJS(haptic)(); }
      } else if (next < 1) phase.set(RefreshPhase.PULLING);
    }
    const reached = y > 0 && y + event.layoutMeasurement.height >= event.contentSize.height - 240;
    if (onEndReached && reached && !nearEnd.value) runOnJS(onEndReached)();
    nearEnd.set(reached);
    const maximum = Math.max(0, event.contentSize.height - event.layoutMeasurement.height);
    const offset = Math.min(maximum, Math.max(0, y));
    const oldOffset = Math.min(maximum, Math.max(0, previous.value));
    const delta = offset - oldOffset;
    const nextCollapsed = offset <= .5 || maximum <= 1 ? false : delta > .1 ? true : delta < -.1 ? false : collapsed.value;
    const nextOverPhoto = y < heroHeight * .48;
    if (nextCollapsed !== collapsed.value || nextOverPhoto !== overPhoto.value) {
      collapsed.set(nextCollapsed); overPhoto.set(nextOverPhoto);
      runOnJS(onScrollState)(nextCollapsed, nextOverPhoto);
    }
    previous.set(y);
    },
  });
  const elastic = useDerivedValue(() => {
    const maximumExpansion = heroHeight * (reduced ? .06 : .32);
    const expansion = maximumExpansion * (1 - Math.exp(-pull.value / maximumExpansion));
    return dragging.value || reduced ? expansion : withSpring(expansion, { damping: 30, stiffness: 280, mass: .8, overshootClamping: true });
  });
  const heroStyle = useAnimatedStyle(() => {
    // This single composition lives outside the bouncing list. Keep its top
    // anchored, independently of scroll-event timing, and cap photographic zoom.
    const expansion = elastic.value;
    return { transform: [{ translateY: -Math.max(0, scrollOffset.value) + expansion / 2 }, { scale: 1 + expansion / heroHeight }] };
  });
  const indicatorStyle = useAnimatedStyle(() => {
    const amount = 1 - Math.pow(1 - progress.value, 2);
    return { opacity: progress.value, transform: [{ translateY: -38 + amount * (topInset + 56) }] };
  });
  const indicator = <Animated.View pointerEvents="none" accessible={refreshing} accessibilityRole="progressbar" accessibilityLabel={refreshing ? 'Refreshing profile' : 'Pull to refresh'} style={[styles.indicator, indicatorStyle]}><ProfileSpinnerGlyph progress={progress} phase={phase} reduced={reduced} /></Animated.View>;
  // Restore navigation/status state on selection without moving either list.
  const syncScrollState = useCallback(() => {
    onScrollState(collapsed.value, scrollOffset.value < heroHeight * .48);
  }, [onScrollState, collapsed, scrollOffset, heroHeight]);
  return { onScroll, heroStyle, indicator, requestRefresh, syncScrollState };
}
const styles = StyleSheet.create({ indicator: { position: 'absolute', top: 0, left: '50%', marginLeft: -16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', zIndex: 10 } });
const presentationBaselineStyles = styles;

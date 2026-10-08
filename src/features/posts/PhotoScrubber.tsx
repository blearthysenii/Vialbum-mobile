import { usePresentationStyles } from '@/theme/presentation';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ProfileTheme } from '@/features/profile/theme';

export const MAX_VISIBLE_DOTS = 7;
const DOT_SLOT = 14; // 8pt active dot plus 6pt spacing; never changes with selection.

export function paginationWindow(count: number, index: number) {
  const length = Math.min(count, MAX_VISIBLE_DOTS);
  const start = Math.max(0, Math.min(index - Math.floor(length / 2), count - length));
  return Array.from({ length }, (_, slot) => {
    const photoIndex = start + slot;
    return { photoIndex, continuation: (slot === 0 && start > 0) || (slot === length - 1 && start + length < count) };
  });
}
function PaginationDot({ active, continuation, reduced, theme }: {
  active: boolean; continuation: boolean; reduced: boolean; theme: ProfileTheme;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const size = active ? 8 : continuation ? 3.5 : 6;
  const color = active ? theme.accent : theme.subtle;
  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: reduced ? size / 8 : withTiming(size / 8, { duration: 150 }) }],
    backgroundColor: reduced ? color : withTiming(color, { duration: 150 }),
    opacity: reduced ? (active ? 1 : 0.35) : withTiming(active ? 1 : 0.35, { duration: 150 }),
  }));
  return <Animated.View style={[styles.dot, animated]} />;
}

export function PhotoScrubber({ count, index, onSelect, theme, onInteractionStart, onInteractionEnd, opacity }: {
  opacity?: SharedValue<number>; count: number; index: number; onSelect: (index: number) => void; theme: ProfileTheme;
  onInteractionStart?: () => void; onInteractionEnd?: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const selected = useSharedValue(index);
  const dragging = useSharedValue(false);
  const scale = useSharedValue(1);
  useEffect(() => { if (!dragging.get()) selected.set(index); }, [index, selected, dragging]);
  const pan = Gesture.Pan().enabled(count > 1 && width > 0).maxPointers(1)
    .activateAfterLongPress(220).activeOffsetX([-3, 3]).failOffsetY([-10, 10])
    .onStart(() => {
      dragging.set(true);
      if (onInteractionStart) runOnJS(onInteractionStart)();
      scale.set(reduced ? 1 : withTiming(1.12, { duration: 120 }));
    })
    .onUpdate(event => {
      const next = Math.max(0, Math.min(count - 1, Math.round(event.x / width * (count - 1))));
      if (next !== selected.get()) {
        selected.set(next);
        runOnJS(onSelect)(next);
      }
    })
    .onFinalize(() => {
      // Keep the last valid selection even when the gesture is cancelled.
      if (dragging.get() && onInteractionEnd) runOnJS(onInteractionEnd)();
      dragging.set(false);
      scale.set(reduced ? 1 : withTiming(1, { duration: 140 }));
    });
  const animated = useAnimatedStyle(() => ({ opacity: opacity?.get() ?? 1, transform: [{ scale: scale.get() }] }));
  const dots = paginationWindow(count, index);
  const firstVisible = dots[0]?.photoIndex ?? 0;
  const rowWidth = dots.length * DOT_SLOT;
  const tap = Gesture.Tap().enabled(count > 1 && width > 0).maxDuration(200).maxDistance(8)
    .onEnd((event, success) => {
      if (!success) return;
      const localX = (event.x - width / 2) / scale.get() + rowWidth / 2;
      // Blank space is for scrubbing only, not an implicit photo button.
      if (localX < 0 || localX >= rowWidth) return;
      const next = firstVisible + Math.floor(localX / DOT_SLOT);
      if (next !== selected.get()) { selected.set(next); runOnJS(onSelect)(next); }
    });
  if (count < 2) return null;
  return <GestureHandlerRootView style={styles.root}><GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
    <View collapsable={false} onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.hitArea}
      accessible accessibilityRole="adjustable" accessibilityLabel="Choose photograph"
      accessibilityValue={{ min: 1, max: count, now: index + 1, text: `Photo ${index + 1} of ${count}` }}
      accessibilityHint="Hold and drag horizontally to choose a photograph, or swipe up or down to adjust."
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
        const next = Math.max(0, Math.min(count - 1, index + delta));
        if (next !== index) onSelect(next);
      }}>
      <Animated.View pointerEvents="none" style={[styles.dots, { width: rowWidth }, animated]}>{dots.map(dot =>
        <Animated.View key={dot.photoIndex} layout={reduced ? undefined : LinearTransition.duration(150)} style={styles.slot}>
          <PaginationDot active={dot.photoIndex === index} continuation={dot.continuation} reduced={reduced} theme={theme} />
        </Animated.View>
      )}</Animated.View>
    </View>
  </GestureDetector></GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  root: { flex: 0, alignSelf: 'center', width: '60%', maxWidth: 260, minWidth: 120 },
  hitArea: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  slot: { width: DOT_SLOT, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
const presentationBaselineStyles = styles;

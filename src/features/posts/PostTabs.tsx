import { darkPalette } from '@/theme/palette';
import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState, type ComponentProps } from 'react';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileTheme } from '@/features/profile/theme';

export type PostTab = 'photos' | 'map' | 'stays';
const postTabs = [
  { id: 'photos', label: 'Photos', icon: 'images-outline' },
  { id: 'map', label: 'Map', icon: 'map-outline' },
  { id: 'stays', label: 'Stays', icon: 'bed-outline' },
] as const;
export type Segment<T extends string> = { id: T; label: string; icon: ComponentProps<typeof Ionicons>['name'] };
const spring = { damping: 22, stiffness: 280, mass: 0.68, overshootClamping: true };

function TabLabel({ tab, index, position, segmentWidth, active, theme }: {
  tab: Segment<string>; index: number; position: SharedValue<number>; segmentWidth: number; active: boolean; theme: ProfileTheme;
}) {
  const highlight = useAnimatedStyle(() => ({
    opacity: segmentWidth > 0 ? Math.max(0, 1 - Math.abs(position.get() / segmentWidth - index)) : Number(active),
  }));
  const label = (color: string) => <><Ionicons name={tab.icon} size={18} color={resolvePresentationColor(color, 'color', 'content')} /><Text style={presentationTextStyle({ color, fontSize: 13, fontWeight: '600', flexShrink: 1 })}>{tab.label}</Text></>;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 6 };
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={row}>{label(theme.muted)}</View>
    <Animated.View style={[row, StyleSheet.absoluteFill, highlight]}>{label(theme.ink)}</Animated.View>
  </View>;
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange, theme, initialWidth = 0, bottomSpacing = 18, deferChangeUntilSettled = false }: { tabs: readonly Segment<T>[]; active: T; onChange: (tab: T) => void; theme: ProfileTheme; initialWidth?: number; bottomSpacing?: number; deferChangeUntilSettled?: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(initialWidth);
  const segmentWidth = Math.max(0, width - 6) / tabs.length;
  const activeIndex = tabs.findIndex(tab => tab.id === active);
  const position = useSharedValue(activeIndex * segmentWidth);
  const start = useSharedValue(0);
  const dragging = useSharedValue(false);
  const committedIndex = useSharedValue(activeIndex);
  useEffect(() => {
    dragging.set(false);
    committedIndex.set(activeIndex);
    const target = activeIndex * segmentWidth;
    position.set(reduceMotion ? target : withSpring(target, spring));
  }, [activeIndex, segmentWidth, reduceMotion, position, dragging, committedIndex]);

  const select = (index: number) => {
    committedIndex.set(index);
    const target = index * segmentWidth;
    position.set(reduceMotion ? target : withSpring(target, spring, finished => {
      if (finished && deferChangeUntilSettled) runOnJS(onChange)(tabs[index].id);
    }));
    if (reduceMotion || !deferChangeUntilSettled) onChange(tabs[index].id);
  };
  // Match the navbar's activation thresholds, but snap to the nearest segment
  // without velocity projection. Only this strip participates in the gesture.
  const pan = Gesture.Pan().enabled(segmentWidth > 0).maxPointers(1)
    .activateAfterLongPress(80).activeOffsetX([-2, 2]).failOffsetY([-18, 18])
    .onStart(() => {
      cancelAnimation(position);
      dragging.set(true);
      start.set(position.get());
    })
    .onUpdate(event => {
      position.set(Math.max(0, Math.min(segmentWidth * (tabs.length - 1), start.get() + event.translationX)));
    })
    .onEnd((_event, success) => {
      if (!success) return;
      const index = Math.max(0, Math.min(tabs.length - 1, Math.round(position.get() / segmentWidth)));
      dragging.set(false);
      committedIndex.set(index);
      const target = index * segmentWidth;
      position.set(reduceMotion ? target : withSpring(target, spring, finished => {
        if (finished && deferChangeUntilSettled) runOnJS(onChange)(tabs[index].id);
      }));
      // Commit content only on release; Profile headers wait for the slide before unmounting.
      if (reduceMotion || !deferChangeUntilSettled) runOnJS(onChange)(tabs[index].id);
    })
    .onFinalize(() => {
      if (dragging.get()) {
        const target = committedIndex.get() * segmentWidth;
        position.set(reduceMotion ? target : withSpring(target, spring));
      }
      dragging.set(false);
    });
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() }] }));
  return <GestureHandlerRootView style={{ flex: 0 }}><GestureDetector gesture={pan}>
    <View collapsable={false} accessibilityRole="tablist" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.tabs, { backgroundColor: resolvePresentationColor(theme.dark ? darkPalette.surface : theme.placeholder, 'backgroundColor', 'surface'), marginBottom: bottomSpacing }]}>
      {segmentWidth > 0 ? <Animated.View pointerEvents="none" style={[styles.active, { left: 3, right: undefined, top: 3, bottom: 3, width: segmentWidth, backgroundColor: resolvePresentationColor(theme.dark ? darkPalette.control : theme.canvas, 'backgroundColor', 'control') }, pillStyle]} /> : null}
      {tabs.map((tab, index) => <Pressable key={tab.id} accessibilityLabel={tab.label} accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }} onPress={() => { if (!dragging.get()) select(index); }} style={({ pressed }) => [styles.tab, { opacity: pressed ? 0.7 : 1 }]}>
        <TabLabel tab={tab} index={index} position={position} segmentWidth={segmentWidth} active={active === tab.id} theme={theme} />
      </Pressable>)}
    </View>
  </GestureDetector></GestureHandlerRootView>;
}
const styles = StyleSheet.create({ tabs: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, padding: 3, borderRadius: 25 }, tab: { flex: 1, minHeight: 44, borderRadius: 22, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingHorizontal: 6, paddingVertical: 8 }, active: { ...StyleSheet.absoluteFill, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }, empty: { minHeight: 200, alignItems: 'center', justifyContent: 'center', padding: 24 } });
const presentationBaselineStyles = styles;

export function PostTabs({ active, onChange, theme }: { active: PostTab; onChange: (tab: PostTab) => void; theme: ProfileTheme }) {
  return <SegmentedTabs tabs={postTabs} active={active} onChange={onChange} theme={theme} />;
}

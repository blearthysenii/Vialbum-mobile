import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import * as React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useProfileTheme } from '@/features/profile/theme';

type Collection = 'journeys' | 'moments';
const tabs = [
  { id: 'journeys' as const, label: 'Journeys', icon: 'map-outline' as const },
  { id: 'moments' as const, label: 'Moments', icon: 'play-circle-outline' as const },
];
export function ProfileMediaTabs({ selected, onChange, contentMargin = 32, bottomSpacing = 0, progress, initialWidth = 0 }: { initialWidth?: number; progress?: SharedValue<number>; selected: Collection; onChange: (value: Collection) => void; contentMargin?: number; bottomSpacing?: number }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const [width, setWidth] = React.useState(Math.max(0, initialWidth));
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: (progress ? progress.value : selected === 'moments' ? 1 : 0) * width / 2 }] }));
  return <View onLayout={event => setWidth(event.nativeEvent.layout.width)} accessibilityRole="tablist" style={{ marginBottom: bottomSpacing }}>
    <View style={[styles.row, { marginHorizontal: contentMargin }]}>{tabs.map(tab => {
      const active = selected === tab.id;
      const color = active ? theme.ink : theme.subtle;
      return <Pressable key={tab.id} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={tab.label} onPress={() => onChange(tab.id)} style={styles.tab}>
        <View style={styles.label}><Ionicons name={tab.icon} size={21} color={resolvePresentationColor(color, 'color', 'content')} /><Text style={presentationTextStyle([styles.text, { color }])}>{tab.label}</Text></View>
      </Pressable>;
    })}</View>
    <View pointerEvents="none" style={[styles.baseline, { backgroundColor: resolvePresentationColor(theme.dark ? '#38383A' : '#D1D1D6', 'backgroundColor', 'separator') }]} />
    <Animated.View pointerEvents="none" style={[styles.underline, { width: '50%', backgroundColor: resolvePresentationColor(theme.ink, 'backgroundColor', 'content') }, indicator]} />
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { width: '50%', height: 48, justifyContent: 'center', alignItems: 'center' },
  label: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  text: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  baseline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  underline: { position: 'absolute', left: 0, bottom: 0, height: 1 },
});
const presentationBaselineStyles = styles;

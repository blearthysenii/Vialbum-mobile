import { usePresentationStyles, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import { BlurView } from 'expo-blur';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import type { JourneySummary } from '@/features/journeys/summary';
import { journeyTimelineStats } from '@/features/journeys/summary';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

export function JourneyStats({
  summary,
  glass = false,
  animate = false,
  reduceMotion = false,
}: {
  summary: JourneySummary;
  glass?: boolean;
  animate?: boolean;
  reduceMotion?: boolean;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const stats = journeyTimelineStats(summary);
  const entrances = useRef(Array.from({ length: 4 }, () => new Animated.Value(animate ? 0 : 1))).current;

  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      entrances.forEach((value) => value.setValue(1));
      return;
    }
    entrances.forEach((value, index) => {
      Animated.timing(value, {
        toValue: 1,
        duration: 280,
        delay: 150 + index * 40,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [animate, entrances, reduceMotion]);

  return <View accessibilityLabel="Journey statistics" style={[styles.row, styles.stableRow]}>
    {stats.map((stat, index) => <Animated.View
      key={index}
      style={[
        styles.stat,
        glass && styles.glassStat,
        styles.stableStat,
        animate && {
          opacity: entrances[index],
          transform: [
            { translateY: entrances[index].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
            { scale: entrances[index].interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
          ],
        },
      ]}
    >
      {glass ? <>
        <BlurView pointerEvents="none" intensity={34} tint={presentationBlurTint("systemUltraThinMaterialLight")} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassTint} />
      </> : null}
      <Text style={presentationTextStyle(styles.value)}>{stat.value}</Text>
      <Text style={presentationTextStyle(styles.label)}>{stat.label}</Text>
    </Animated.View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stableRow: { flexWrap: 'nowrap' },
  stat: { minWidth: 72, flexGrow: 1, flexBasis: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceWarm },
  stableStat: { minWidth: 0, flexBasis: 0, height: 76, justifyContent: 'center' },
  glassStat: { backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.42)', overflow: 'hidden' },
  glassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  value: { ...typography.sectionTitle, color: colors.ink },
  label: { ...typography.metadata, color: colors.muted, marginTop: 2 },
});
const presentationBaselineStyles = styles;

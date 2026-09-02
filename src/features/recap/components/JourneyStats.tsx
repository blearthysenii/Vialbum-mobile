import { StyleSheet, Text, View } from 'react-native';

import type { JourneySummary } from '@/features/recap/summary';
import { journeyStats } from '@/features/recap/summary';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

export function JourneyStats({ summary }: { summary: JourneySummary }) {
  return <View accessibilityLabel="Journey statistics" style={styles.row}>
    {journeyStats(summary).map((stat) => <View key={stat.label} style={styles.stat}>
      <Text style={styles.value}>{stat.value}</Text>
      <Text style={styles.label}>{stat.label}</Text>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  stat: { minWidth: 72, flexGrow: 1, flexBasis: 72, paddingHorizontal: spacing.sm, paddingVertical: spacing.md, borderRadius: radii.md, backgroundColor: colors.surfaceWarm },
  value: { ...typography.sectionTitle, color: colors.ink },
  label: { ...typography.metadata, color: colors.muted, marginTop: 2 },
});


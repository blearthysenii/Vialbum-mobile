import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/tokens';

export function MetadataRow({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <View style={styles.row}>{icon}<View style={styles.copy}><Text style={styles.label}>{label.toUpperCase()}</Text><Text style={styles.value}>{value}</Text></View></View>;
}

export function MetadataLine({ children }: { children: ReactNode }) {
  return <Text style={styles.line}>{children}</Text>;
}

const styles = StyleSheet.create({
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line }, copy: { flex: 1 },
  label: { ...typography.eyebrow, color: colors.muted, fontSize: 9 }, value: { ...typography.body, color: colors.ink, marginTop: 2 }, line: { ...typography.metadata, color: colors.muted },
});

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { controlHeights, typography } from '@/theme/tokens';

export function SheetHeader({ title, onClose, trailing }: { title: string; onClose: () => void; trailing?: ReactNode }) {
  return <View style={styles.sheet}><Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onClose} style={styles.side}><Text style={styles.action}>Cancel</Text></Pressable><Text style={styles.sheetTitle}>{title}</Text><View style={styles.side}>{trailing}</View></View>;
}

export function ScreenHeader({ eyebrow, title, trailing }: { eyebrow?: string; title: string; trailing?: ReactNode }) {
  return <View style={styles.screen}><View>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.title}>{title}</Text></View>{trailing}</View>;
}

export function BackButton({ onPress, light = false }: { onPress: () => void; light?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={onPress} style={[styles.back, light && styles.backLight]}><View style={styles.chevron} /></Pressable>;
}

export function CloseButton({ onPress, dark = false }: { onPress: () => void; dark?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} onPress={onPress} style={[styles.back, dark && styles.closeDark]}><View style={styles.closeLine} /><View style={[styles.closeLine, styles.closeLineAlt]} /></Pressable>;
}

const styles = StyleSheet.create({
  sheet: { minHeight: controlHeights.compact, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, side: { width: 68 }, action: { ...typography.button, color: colors.accent, fontSize: 14 }, sheetTitle: { ...typography.cardTitle, fontSize: 17 },
  screen: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }, eyebrow: { ...typography.eyebrow, color: colors.accent }, title: { ...typography.screenTitle, color: colors.ink, marginTop: spacing.xs },
  back: { width: controlHeights.compact, height: controlHeights.compact, borderRadius: 22, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, backLight: { backgroundColor: 'rgba(255,255,255,0.92)' }, closeDark: { backgroundColor: 'rgba(28,28,25,0.75)' }, chevron: { width: 11, height: 11, borderLeftWidth: 2, borderBottomWidth: 2, borderColor: colors.ink, transform: [{ rotate: '45deg' }], marginLeft: 4 }, closeLine: { position: 'absolute', width: 16, height: 2, borderRadius: 1, backgroundColor: colors.onDark, transform: [{ rotate: '45deg' }] }, closeLineAlt: { transform: [{ rotate: '-45deg' }] },
});

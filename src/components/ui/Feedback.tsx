import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{message}</Text>{onRetry ? <Pressable accessibilityRole="button" onPress={onRetry}><Text style={styles.retry}>Try Again</Text></Pressable> : null}</View>;
}

export function EmptyState({ title, message, actionLabel, onAction, mark = 'V' }: { title: string; message: string; actionLabel?: string; onAction?: () => void; mark?: string }) {
  return <View style={styles.empty}><View style={styles.mark}><Text style={styles.markText}>{mark}</Text></View><Text style={styles.title}>{title}</Text><Text style={styles.message}>{message}</Text>{actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.action}><Text style={styles.actionText}>{actionLabel}</Text></Pressable> : null}</View>;
}

export function LoadingState({ label = 'Loading…', fullScreen = false }: { label?: string; fullScreen?: boolean }) {
  return <View accessibilityRole="progressbar" style={[styles.loading, fullScreen && styles.full]}><ActivityIndicator color={colors.accent} /><Text style={styles.loadingText}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  error: { borderRadius: radii.md, borderWidth: 1, borderColor: '#D9B8AE', backgroundColor: '#F5E9E4', padding: spacing.md, gap: spacing.sm },
  errorText: { ...typography.body, color: colors.danger }, retry: { ...typography.button, color: colors.danger },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, mark: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.accent, fontSize: 25, fontWeight: '900' }, title: { ...typography.sectionTitle, color: colors.ink, textAlign: 'center', marginTop: spacing.lg },
  message: { ...typography.body, color: colors.muted, textAlign: 'center', maxWidth: 320, marginTop: spacing.sm }, action: { minHeight: 52, borderRadius: radii.md, backgroundColor: colors.ink, paddingHorizontal: spacing.lg, justifyContent: 'center', marginTop: spacing.lg }, actionText: { ...typography.button, color: colors.onDark },
  loading: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg }, full: { flex: 1, backgroundColor: colors.canvas }, loadingText: { ...typography.body, color: colors.muted },
});

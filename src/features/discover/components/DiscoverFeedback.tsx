import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProfileTheme } from '@/features/profile/theme';

export function DiscoverSkeletons({ theme }: { theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View accessibilityLabel="Loading discoveries" style={styles.skeletons}>{[0, 1].map((column) => <View key={column} style={styles.column}>{[0, 1, 2].map((row) => <View key={row} style={[styles.skeletonCard, { aspectRatio: [0.72, 0.86, 0.78, 0.94, 0.82][(column * 3 + row) % 5], backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'surface') }]} />)}</View>)}</View>;
}
export function DiscoverEmptyState({ theme }: { theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View style={styles.empty}><Ionicons name="compass-outline" size={36} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>No journeys to discover yet.</Text><Text style={presentationTextStyle([styles.message, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>When travelers share their journeys, you’ll find new places and stories here.</Text></View>;
}
export function DiscoverError({ message, onRetry, theme }: { message: string; onRetry: () => void; theme: ProfileTheme }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <View accessibilityRole="alert" style={styles.error}><Text style={presentationTextStyle([styles.message, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{message}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontWeight: '600' })}>Try again</Text></Pressable></View>;
}
const styles = StyleSheet.create({
  skeletons: { flexDirection: 'row', gap: 10, paddingHorizontal: 5 }, column: { flex: 1 }, skeletonCard: { marginBottom: 11, borderRadius: 22, borderCurve: 'continuous' },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 70, gap: 12 },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '600', textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center' }, error: { padding: 20, alignItems: 'center' }, retry: { padding: 12 },
});
const presentationBaselineStyles = styles;

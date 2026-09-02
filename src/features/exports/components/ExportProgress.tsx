import { Modal, StyleSheet, Text, View } from 'react-native';

import { LoadingState } from '@/components/ui/Feedback';
import type { ExportState } from '@/features/exports/utils';
import { exportStateMessage } from '@/features/exports/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, shadows, typography } from '@/theme/tokens';

export function ExportProgress({ state }: { state: ExportState }) {
  const message = exportStateMessage(state);
  return <Modal transparent animationType="fade" visible={Boolean(message)}>
    <View accessibilityViewIsModal style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PRIVATE EXPORT</Text>
        <Text style={styles.title}>Gathering your Vialbum</Text>
        <LoadingState label={message ?? ''} />
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 360, borderRadius: radii.xl, backgroundColor: colors.canvas, padding: spacing.lg, ...shadows.sheet },
  eyebrow: { ...typography.eyebrow, color: colors.accent }, title: { ...typography.sectionTitle, color: colors.ink, marginTop: spacing.xs },
});

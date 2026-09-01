import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/tokens';

type Props = TextInputProps & { label: string; hint?: string; error?: string; contained?: boolean };

export function TextField({ label, hint, error, contained, multiline, style, ...inputProps }: Props) {
  return <View style={styles.wrap}>
    <Text style={styles.label}>{label.toUpperCase()}</Text>
    <TextInput {...inputProps} accessibilityLabel={inputProps.accessibilityLabel ?? label} autoCorrect={inputProps.autoCorrect ?? false}
      multiline={multiline} placeholderTextColor={colors.placeholder} selectionColor={colors.accent}
      style={[styles.input, contained && styles.contained, multiline && styles.multiline, error && styles.inputError, style]} />
    {error || hint ? <Text accessibilityRole={error ? 'alert' : undefined} style={[styles.support, error && styles.error]}>{error ?? hint}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs }, label: { ...typography.eyebrow, color: colors.muted, fontSize: 9, lineHeight: 13, letterSpacing: 1.5 },
  input: { minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 0, paddingVertical: 8, color: colors.ink, fontSize: 18 },
  contained: { borderBottomWidth: 0, borderRadius: 16, backgroundColor: colors.surfaceWarm, paddingHorizontal: 16 },
  multiline: { minHeight: 108, paddingTop: 14, textAlignVertical: 'top' }, inputError: { borderColor: colors.danger },
  support: { ...typography.metadata, color: colors.muted }, error: { color: colors.danger },
});

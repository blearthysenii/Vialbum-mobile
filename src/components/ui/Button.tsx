import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { controlHeights, radii, typography } from '@/theme/tokens';

type ButtonProps = PropsWithChildren<{
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}>;

function Button({ children, onPress, accessibilityLabel, disabled, loading, style, variant }: ButtonProps & { variant: 'primary' | 'secondary' | 'quiet' | 'destructive' }) {
  const inactive = disabled || loading;
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} accessibilityState={{ disabled: inactive, busy: loading }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.base, styles[variant], variant === 'quiet' && styles.quietBase, pressed && styles.pressed, inactive && styles.disabled, style]}>
    {loading ? <ActivityIndicator color={variant === 'primary' ? colors.onDark : variant === 'destructive' ? colors.danger : colors.ink} />
      : <Text style={[styles.label, styles[`${variant}Label`]]}>{children}</Text>}
  </Pressable>;
}

export const PrimaryButton = (props: ButtonProps) => <Button {...props} variant="primary" />;
export const SecondaryButton = (props: ButtonProps) => <Button {...props} variant="secondary" />;
export const QuietButton = (props: ButtonProps) => <Button {...props} variant="quiet" />;
export const DestructiveButton = (props: ButtonProps) => <Button {...props} variant="destructive" />;

const styles = StyleSheet.create({
  base: { minHeight: controlHeights.standard, borderRadius: radii.md, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.ink }, secondary: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  quiet: { backgroundColor: 'transparent' }, quietBase: { minHeight: controlHeights.compact, paddingHorizontal: 12 },
  destructive: { borderWidth: 1, borderColor: '#D9B8AE', backgroundColor: '#F5E9E4' },
  label: { ...typography.button }, primaryLabel: { color: colors.onDark }, secondaryLabel: { color: colors.ink }, quietLabel: { color: colors.accent }, destructiveLabel: { color: colors.danger },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.5 },
});

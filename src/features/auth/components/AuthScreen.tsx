import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { typography } from '@/theme/tokens';

type AuthScreenProps = PropsWithChildren<{ eyebrow: string; title: string; subtitle: string }>;

export function AuthScreen({ eyebrow, title, subtitle, children }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={styles.brand}><Text style={styles.brandText}>V</Text></View>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl },
  brand: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 42 },
  brandText: { color: colors.canvas, fontWeight: '900', fontSize: 17 },
  eyebrow: { ...typography.eyebrow, color: colors.accent },
  title: { ...typography.display, color: colors.ink, marginTop: spacing.sm },
  subtitle: { ...typography.bodyLarge, color: colors.muted, marginTop: spacing.sm, maxWidth: 340 },
});

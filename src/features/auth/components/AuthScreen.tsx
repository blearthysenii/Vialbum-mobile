import { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

type AuthScreenProps = PropsWithChildren<{ eyebrow: string; title: string; subtitle: string }>;

export function AuthScreen({ eyebrow, title, subtitle, children }: AuthScreenProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
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
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 36 },
  brand: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', marginBottom: 42 },
  brandText: { color: colors.canvas, fontWeight: '900', fontSize: 17 },
  eyebrow: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 42, lineHeight: 45, fontWeight: '800', letterSpacing: -1.8, marginTop: 10 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 12, maxWidth: 330 },
});

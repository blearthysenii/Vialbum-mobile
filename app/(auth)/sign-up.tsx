import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { AuthField } from '@/features/auth/components/AuthField';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { authErrorMessage } from '@/features/auth/errors';
import { colors } from '@/theme/colors';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const update = (field: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [field]: value }));

  async function submit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) { setError('Complete every field to create your account.'); return; }
    if (form.password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('The passwords do not match.'); return; }
    setError(null);
    setIsSubmitting(true);
    try {
      await signUp({ first_name: form.firstName.trim(), last_name: form.lastName.trim(), email: form.email.trim(), password: form.password });
      router.replace('/');
    } catch (caughtError) {
      setError(authErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen eyebrow="BEGIN YOUR ALBUM" title="Keep every journey close." subtitle="Create your private place for travel memories, photographs, and stories.">
      <View style={styles.form}>
        <View style={styles.nameRow}><View style={styles.nameField}><AuthField label="First name" value={form.firstName} onChangeText={update('firstName')} placeholder="First name" textContentType="givenName" /></View><View style={styles.nameField}><AuthField label="Last name" value={form.lastName} onChangeText={update('lastName')} placeholder="Last name" textContentType="familyName" /></View></View>
        <AuthField label="Email" value={form.email} onChangeText={update('email')} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
        <AuthField label="Password" value={form.password} onChangeText={update('password')} placeholder="At least 8 characters" secureTextEntry textContentType="newPassword" />
        <AuthField label="Confirm password" value={form.confirmPassword} onChangeText={update('confirmPassword')} placeholder="Repeat your password" secureTextEntry textContentType="newPassword" />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={isSubmitting} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>{isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Create Account</Text>}</Pressable>
      <View style={styles.footer}><Text style={styles.footerText}>Already have an account?</Text><Link href="/sign-in" style={styles.link}>Sign in</Link></View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ form: { marginTop: 30 }, nameRow: { flexDirection: 'row', gap: 16 }, nameField: { flex: 1 }, error: { color: '#A33D2D', fontSize: 13, lineHeight: 19, marginTop: 14 }, button: { backgroundColor: colors.ink, borderRadius: 18, height: 58, alignItems: 'center', justifyContent: 'center', marginTop: 26 }, pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.65 }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }, footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 20 }, footerText: { color: colors.muted, fontSize: 13 }, link: { color: colors.accent, fontSize: 13, fontWeight: '800' } });

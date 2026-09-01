import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/errors';
import { AuthField } from '@/features/auth/components/AuthField';
import { AuthScreen } from '@/features/auth/components/AuthScreen';
import { colors } from '@/theme/colors';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (caughtError) {
      setError(authErrorMessage(caughtError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen eyebrow="WELCOME BACK" title="Return to your journeys." subtitle="Sign in to continue collecting the places and moments that matter.">
      <View style={styles.form}>
        <AuthField label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" />
        <AuthField label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry textContentType="password" />
      </View>
      {error ? <View style={styles.feedback}><ErrorBanner message={error} /></View> : null}
      <PrimaryButton loading={isSubmitting} onPress={() => void submit()} style={styles.button}>Sign In</PrimaryButton>
      <View style={styles.footer}><Text style={styles.footerText}>New to Vialbum?</Text><Link href="/sign-up" style={styles.link}>Create an account</Link></View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ form: { marginTop: 38, gap: 14 }, feedback: { marginTop: 16 }, button: { marginTop: 24 }, footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 }, footerText: { color: colors.muted, fontSize: 13 }, link: { color: colors.accent, fontSize: 13, fontWeight: '800' } });

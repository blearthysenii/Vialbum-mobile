import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

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
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable disabled={isSubmitting} onPress={submit} style={({ pressed }) => [styles.button, pressed && styles.pressed, isSubmitting && styles.disabled]}>
        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </Pressable>
      <View style={styles.footer}><Text style={styles.footerText}>New to Vialbum?</Text><Link href="/sign-up" style={styles.link}>Create an account</Link></View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({ form: { marginTop: 38 }, error: { color: '#A33D2D', fontSize: 13, lineHeight: 19, marginTop: 14 }, button: { backgroundColor: colors.ink, borderRadius: 18, height: 58, alignItems: 'center', justifyContent: 'center', marginTop: 28 }, pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] }, disabled: { opacity: 0.65 }, buttonText: { color: '#FFF', fontSize: 16, fontWeight: '800' }, footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 22 }, footerText: { color: colors.muted, fontSize: 13 }, link: { color: colors.accent, fontSize: 13, fontWeight: '800' } });

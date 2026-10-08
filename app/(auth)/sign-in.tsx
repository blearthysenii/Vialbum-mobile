import { resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { AuthVortexMark } from '@/features/auth/components/AuthVortexMark';
import { ErrorBanner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import { authApi } from '@/features/auth/api';
import { PasswordVisibilityToggle } from '@/features/auth/components/PasswordVisibilityToggle';
import { type AuthThemeColors, useAuthTheme } from '@/features/auth/theme';
import { systemFont } from '@/theme/tokens';

const PASSWORD_STEP_ANIMATION_DURATION = 260;
const PASSWORD_FOCUS_DELAY = Math.round(PASSWORD_STEP_ANIMATION_DURATION * 0.7);
const GENERIC_AUTH_FAILURE = 'The email, username, or password is incorrect.';

export default function SignInScreen() {
  const { isDark, colors: authColors } = useAuthTheme();
  const params = useLocalSearchParams<{ email?: string; identifier?: string }>();
  const styles = useMemo(() => createStyles(authColors, isDark), [authColors, isDark]);
  const { signIn, isRestoring, savedAccounts, savedAccountsError, reloadSavedAccounts, quickSignIn, removeSavedAccount } = useAuth();
  const [showForm, setShowForm] = useState(Boolean(params.identifier ?? params.email));
  const [accountBusy, setAccountBusy] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const passwordRef = useRef<TextInput>(null);
  const accountCheckId = useRef(0);
  const [identifier, setIdentifier] = useState(() => params.identifier ?? params.email ?? '');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAccountMissing, setIsAccountMissing] = useState(false);
  const [step, setStep] = useState<'email' | 'password'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const markProgress = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const formProgress = useSharedValue(0);
  const footerProgress = useSharedValue(0);
  const passwordProgress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      markProgress.value = 1;
      titleProgress.value = 1;
      formProgress.value = 1;
      footerProgress.value = 1;
      return;
    }

    const timing = { duration: 420, easing: Easing.out(Easing.cubic) };
    markProgress.value = withTiming(1, timing);
    titleProgress.value = withDelay(100, withTiming(1, timing));
    formProgress.value = withDelay(190, withTiming(1, timing));
    footerProgress.value = withDelay(280, withTiming(1, timing));

    return () => {
      cancelAnimation(markProgress);
      cancelAnimation(titleProgress);
      cancelAnimation(formProgress);
      cancelAnimation(footerProgress);
    };
  }, [footerProgress, formProgress, markProgress, reduceMotion, titleProgress]);

  useEffect(() => {
    if (step === 'email') {
      passwordProgress.value = 0;
      return;
    }

    passwordProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: PASSWORD_STEP_ANIMATION_DURATION, easing: Easing.out(Easing.cubic) });
    const focusTimer = setTimeout(() => passwordRef.current?.focus(), reduceMotion ? 0 : PASSWORD_FOCUS_DELAY);

    return () => {
      clearTimeout(focusTimer);
      cancelAnimation(passwordProgress);
    };
  }, [passwordProgress, reduceMotion, step]);

  const markAnimation = useAnimatedStyle(() => ({
    opacity: markProgress.value,
    transform: [{ scale: 0.92 + markProgress.value * 0.08 }],
  }));
  const titleAnimation = useAnimatedStyle(() => ({
    opacity: titleProgress.value,
    transform: [{ translateY: (1 - titleProgress.value) * 7 }],
  }));
  const formAnimation = useAnimatedStyle(() => ({
    opacity: formProgress.value,
    transform: [{ translateY: (1 - formProgress.value) * 10 }],
  }));
  const footerAnimation = useAnimatedStyle(() => ({
    opacity: footerProgress.value,
    transform: [{ translateY: (1 - footerProgress.value) * 5 }],
  }));
  const passwordAnimation = useAnimatedStyle(() => ({
    opacity: passwordProgress.value,
    transform: [{ translateY: (1 - passwordProgress.value) * -4 }],
  }));

  function updateIdentifier(value: string) {
    accountCheckId.current += 1;
    setIdentifier(value);
    setError(null);
    setIsAccountMissing(false);
    if (step === 'password') {
      setStep('email');
      setPassword('');
    }
  }

  async function continueWithIdentifier() {
    if (isSubmitting) return;

    const normalizedIdentifier = identifier.trim().toLowerCase();
    if (!normalizedIdentifier) {
      setError('Enter your email or username.');
      return;
    }

    setError(null);
    setIsAccountMissing(false);
    setIsSubmitting(true);
    const checkId = ++accountCheckId.current;
    try {
      const result = await authApi.accountExists(normalizedIdentifier);
      if (checkId !== accountCheckId.current) return;
      setIdentifier(normalizedIdentifier);
      if (!result.exists) {
        setIsAccountMissing(true);
        return;
      }
      setStep('password');
    } catch {
      if (checkId !== accountCheckId.current) return;
      setError('Unable to verify this account. Try again.');
    } finally {
      if (checkId === accountCheckId.current) setIsSubmitting(false);
    }
  }

  function updatePassword(value: string) {
    setPassword(value);
    setError(null);
  }

  async function submit() {
    if (isSubmitting) return;
    if (!password) {
      setError('Enter your password.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(identifier.trim().toLowerCase(), password);
      router.replace('/');
    } catch {
      setError(GENERIC_AUTH_FAILURE);
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectPassword(email: string) {
    updateIdentifier(email);
    setPassword('');
    setIsPasswordVisible(false);
    setShowForm(true);
    setStep('password');
  }

  async function openAccount(id: string, email: string) {
    if (accountBusy) return;
    setAccountBusy(id);
    setError(null);
    try {
      if (await quickSignIn(id)) router.replace('/');
      else {
        selectPassword(email);
        setError('Please enter your password to sign in.');
      }
    } catch {
      setError('Unable to sign in. Check your connection or use your password.');
    } finally { setAccountBusy(null); }
  }

  function confirmRemove(id: string) {
    Alert.alert('Remove account from this device?', 'This does not delete your Vialbum account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        setAccountBusy(id);
        setError(null);
        void removeSavedAccount(id).catch(() => setError('Unable to remove this account. Please try again.'))
          .finally(() => setAccountBusy(null));
      } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <Animated.View shouldRasterizeIOS={false} style={markAnimation}>
              <AuthVortexMark authColors={authColors} isDark={isDark} />
            </Animated.View>
            <Animated.View shouldRasterizeIOS={false} style={titleAnimation}>
              <Text style={presentationTextStyle(styles.title)}>Sign in to Vialbum</Text>
            </Animated.View>
          </View>

          {isRestoring ? <ActivityIndicator style={styles.feedback} color={resolvePresentationColor(authColors.body, 'color', 'content')} accessibilityLabel="Loading saved accounts" /> : null}
          {savedAccountsError ? <View style={styles.feedback}>
            <ErrorBanner message={savedAccountsError} style={styles.errorBanner} textStyle={styles.errorText} />
            <Pressable accessibilityRole="button" onPress={() => void reloadSavedAccounts()} style={styles.accountAction}><Text style={presentationTextStyle(styles.link)}>Try again</Text></Pressable>
          </View> : null}
          {!showForm && !isRestoring ? <View style={styles.feedback}>
            {savedAccounts.length ? savedAccounts.map((account) => <View key={account.id} style={styles.accountCard}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Continue as ${account.username}`} disabled={Boolean(accountBusy)}
                onPress={() => void openAccount(account.id, account.email)} style={styles.accountIdentity}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={24} color={resolvePresentationColor(authColors.body, 'color', 'content')} />
                  {account.profile_photo_url ? <Image source={{ uri: account.profile_photo_url }} style={StyleSheet.absoluteFill} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={presentationTextStyle(styles.accountName)}>{[account.first_name, account.last_name].filter(Boolean).join(' ') || account.username}</Text>
                  <Text style={presentationTextStyle(styles.footerText)} numberOfLines={1}>@{account.username}</Text>
                  <Text style={presentationTextStyle(styles.footerText)} numberOfLines={1}>{account.email}</Text>
                </View>
                {accountBusy === account.id ? <ActivityIndicator color={resolvePresentationColor(authColors.body, 'color', 'content')} /> : <Ionicons name="chevron-forward" size={18} color={resolvePresentationColor(authColors.body, 'color', 'content')} />}
              </Pressable>
              <View style={styles.accountActions}>
                <Pressable accessibilityRole="button" disabled={Boolean(accountBusy)} onPress={() => selectPassword(account.email)} style={styles.accountAction}><Text style={presentationTextStyle(styles.link)}>Use password</Text></Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${account.username} from this device`} disabled={Boolean(accountBusy)} onPress={() => confirmRemove(account.id)} style={styles.accountAction}><Text style={presentationTextStyle(styles.link)}>Remove</Text></Pressable>
              </View>
            </View>) : <Text style={presentationTextStyle(styles.footerText)}>No saved accounts on this device.</Text>}
            {savedAccounts.length ? <Pressable accessibilityRole="button" disabled={Boolean(accountBusy)} onPress={() => { setError(null); setShowForm(true); }} style={styles.accountAction}><Text style={presentationTextStyle(styles.link)}>Use another account</Text></Pressable> : null}
          </View> : null}
          {showForm || (!isRestoring && !savedAccounts.length) ? <>
          <Animated.View shouldRasterizeIOS={false} style={[styles.formCard, formAnimation]}>
            <BlurView pointerEvents="none" tint={presentationBlurTint(isDark ? 'dark' : 'light')} intensity={isDark ? 38 : 28} style={StyleSheet.absoluteFill} />
            <View style={styles.inputRow}>
              <TextInput
                accessibilityLabel="Email or username"
                editable={!isSubmitting}
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                onChangeText={updateIdentifier}
                onSubmitEditing={() => step === 'email' ? void continueWithIdentifier() : passwordRef.current?.focus()}
                placeholder="Email or username"
                keyboardAppearance={isDark ? 'dark' : 'light'}
                placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')}
                returnKeyType="next"
                textContentType="username"
                value={identifier}
                style={presentationTextStyle(styles.input)}
              />
              {step === 'email' ? (
                <Pressable
                  accessibilityLabel="Continue"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isSubmitting }}
                  disabled={isSubmitting}
                  hitSlop={8}
                  onPress={() => void continueWithIdentifier()}
                  style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, isSubmitting && styles.submitDisabled]}
                >
                  {isSubmitting
                    ? <ActivityIndicator size="small" color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />
                    : <Ionicons name="arrow-forward" size={18} color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />}
                </Pressable>
              ) : <Ionicons accessibilityLabel="Email found" name="checkmark-circle" size={22} color={resolvePresentationColor(authColors.success, 'color', 'content')} />}
            </View>
            {step === 'password' ? (
              <Animated.View style={[styles.passwordStep, passwordAnimation]}>
                <View style={styles.separator} />
                <View style={styles.inputRow}>
                  <TextInput
                    ref={passwordRef}
                    accessibilityLabel="Password"
                    editable={!isSubmitting}
                    autoCapitalize="none"
                    autoComplete="current-password"
                    autoCorrect={false}
                    onChangeText={updatePassword}
                    onSubmitEditing={() => void submit()}
                    placeholder="Password"
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                    placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')}
                    returnKeyType="go"
                    secureTextEntry={!isPasswordVisible}
                    spellCheck={false}
                    textContentType="password"
                    value={password}
                    style={presentationTextStyle(styles.input)}
                  />
                  <PasswordVisibilityToggle
                    color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')}
                    isVisible={isPasswordVisible}
                    onToggle={() => setIsPasswordVisible((current) => !current)}
                  />
                  <Pressable
                    accessibilityLabel="Sign in"
                    accessibilityRole="button"
                    accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
                    disabled={isSubmitting}
                    hitSlop={8}
                    onPress={() => void submit()}
                    style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, isSubmitting && styles.submitDisabled]}
                  >
                    {isSubmitting
                      ? <ActivityIndicator size="small" color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />
                      : <Ionicons name="arrow-forward" size={18} color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />}
                  </Pressable>
                </View>
              </Animated.View>
            ) : null}
          </Animated.View>

          {showForm && savedAccounts.length ? <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => { updateIdentifier(''); setPassword(''); setShowForm(false); }} style={styles.accountAction}><Text style={presentationTextStyle(styles.link)}>Saved accounts</Text></Pressable> : null}
          </> : null}

          {isAccountMissing ? (
            <View accessibilityRole="alert" style={[styles.errorBanner, styles.unregisteredBanner]}>
              <Text style={presentationTextStyle(styles.errorText)}>No account found with this email or username.</Text>
            </View>
          ) : null}
          {error ? <View style={styles.feedback}><ErrorBanner message={error} style={styles.errorBanner} textStyle={styles.errorText} /></View> : null}

          <Animated.View shouldRasterizeIOS={false} style={[styles.footer, footerAnimation]}>
            <Text style={presentationTextStyle(styles.footerText)}>New to Vialbum?</Text>
            <Link href="/sign-up" asChild>
              <Pressable
                hitSlop={10}
                unstable_pressDelay={0}
                style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
              >
                {({ pressed }) => (
                  <Text style={presentationTextStyle([styles.link, pressed && styles.linkPressed])}>Create an account</Text>
                )}
              </Pressable>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AuthThemeColors, isDark: boolean) {
 return StyleSheet.create({
  accountCard: { backgroundColor: theme.surface, borderColor: theme.glassBorder, borderWidth: StyleSheet.hairlineWidth, borderRadius: 17, marginTop: 12, padding: 14 },
  accountIdentity: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64 },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: theme.control, alignItems: 'center', justifyContent: 'center' },
  accountName: { color: theme.title, fontSize: 17, fontWeight: '600' },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  accountAction: { minHeight: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  safe: { flex: 1, backgroundColor: theme.canvas },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 120 },
  hero: { alignItems: 'center' },
  title: { color: theme.title, fontFamily: systemFont, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9, marginTop: 32 },
  formCard: { marginTop: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, borderRadius: 17, backgroundColor: theme.surface, overflow: 'hidden', shadowColor: theme.shadow, shadowOpacity: isDark ? 0.18 : 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  inputRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingLeft: 17, paddingRight: 10 },
  input: { flex: 1, minHeight: 58, paddingVertical: 14, color: theme.inputText, fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: 17 },
  passwordStep: { overflow: 'hidden' },
  submit: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.control },
  submitPressed: { opacity: 0.62, transform: [{ scale: 0.96 }] },
  submitDisabled: { opacity: 0.45 },
  feedback: { marginTop: 16 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 28 },
  errorBanner: { borderColor: theme.errorIcon, backgroundColor: theme.errorSurface },
  unregisteredBanner: { marginTop: 16, borderRadius: 14, borderWidth: 1, padding: 16 },
  errorText: { color: theme.errorText, fontFamily: systemFont, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  footerText: { color: theme.body, fontFamily: systemFont, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: -0.1 },
  linkButton: { paddingHorizontal: 3, paddingVertical: 2 },
  linkButtonPressed: { transform: [{ scale: 0.96 }] },
  link: { color: theme.link, fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: -0.1, textDecorationLine: 'none' },
  linkPressed: { opacity: 0.55 },
});
}

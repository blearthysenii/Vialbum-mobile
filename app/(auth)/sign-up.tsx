import { resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

import { ErrorBanner } from '@/components/ui/Feedback';
import { ApiError } from '@/api/client';
import { useAuth } from '@/features/auth/AuthProvider';
import { authApi } from '@/features/auth/api';
import { AuthVortexMark } from '@/features/auth/components/AuthVortexMark';
import { PasswordVisibilityToggle } from '@/features/auth/components/PasswordVisibilityToggle';
import { authErrorMessage } from '@/features/auth/errors';
import { type AuthThemeColors, useAuthTheme } from '@/features/auth/theme';
import { systemFont } from '@/theme/tokens';

const VERIFICATION_CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const VERIFICATION_DELAY_MS = 450;
const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

export default function SignUpScreen() {
  const { isDark, colors: authColors } = useAuthTheme();
  const styles = useMemo(() => createStyles(authColors, isDark), [authColors, isDark]);
  const { signUp } = useAuth();
  const reduceMotion = useReducedMotion();
  const lastNameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const codeInputRefs = useRef<(TextInput | null)[]>([]);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const verificationDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const availabilityCheckId = useRef(0);
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<'form' | 'verification'>('form');
  const [verificationCode, setVerificationCode] = useState(() => Array(VERIFICATION_CODE_LENGTH).fill('') as string[]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendFeedback, setResendFeedback] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const markProgress = useSharedValue(0);
  const titleProgress = useSharedValue(0);
  const formProgress = useSharedValue(0);
  const footerProgress = useSharedValue(0);
  const verificationProgress = useSharedValue(0);
  const update = (field: keyof typeof form) => (value: string) => {
    if (field === 'username' || field === 'email') availabilityCheckId.current += 1;
    if (field === 'username') setUsernameError(null);
    if (field === 'email') setEmailError(null);
    setError(null);
    setForm((current) => ({ ...current, [field]: value }));
  };

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
    if (step !== 'verification') {
      verificationProgress.value = 0;
      return;
    }
    verificationProgress.value = reduceMotion
      ? 1
      : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    const focusTimer = setTimeout(() => codeInputRefs.current[0]?.focus(), reduceMotion ? 0 : 220);
    return () => {
      clearTimeout(focusTimer);
      cancelAnimation(verificationProgress);
    };
  }, [reduceMotion, step, verificationProgress]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((current) => Math.max(0, current - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    if (emailFocusTimerRef.current) clearTimeout(emailFocusTimerRef.current);
    if (verificationDelayRef.current) clearTimeout(verificationDelayRef.current);
  }, []);

  const markAnimation = useAnimatedStyle(() => ({ opacity: markProgress.value, transform: [{ scale: 0.92 + markProgress.value * 0.08 }] }));
  const titleAnimation = useAnimatedStyle(() => ({ opacity: titleProgress.value, transform: [{ translateY: (1 - titleProgress.value) * 7 }] }));
  const formAnimation = useAnimatedStyle(() => ({ opacity: formProgress.value, transform: [{ translateY: (1 - formProgress.value) * 10 }] }));
  const footerAnimation = useAnimatedStyle(() => ({ opacity: footerProgress.value, transform: [{ translateY: (1 - footerProgress.value) * 5 }] }));
  const verificationAnimation = useAnimatedStyle(() => ({
    opacity: verificationProgress.value,
    transform: [{ translateY: (1 - verificationProgress.value) * 8 }],
  }));

  async function continueToVerification() {
    if (isSubmitting) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.password) { setError('Complete every field to create your account.'); return; }
    if (form.password.length < 8) { setError('Use a password with at least 8 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('The passwords do not match.'); return; }
    const username = form.username.trim().toLowerCase();
    const email = form.email.trim().toLowerCase();
    if (!USERNAME_PATTERN.test(username)) {
      setUsernameError('Use 3–30 lowercase letters, numbers, or underscores.');
      usernameRef.current?.focus();
      return;
    }
    setError(null);
    setUsernameError(null);
    setEmailError(null);
    setIsSubmitting(true);
    const checkId = ++availabilityCheckId.current;
    try {
      const [usernameResult, emailResult] = await Promise.all([
        authApi.usernameExists(username),
        authApi.emailExists(email),
      ]);
      if (checkId !== availabilityCheckId.current) return;
      if (usernameResult.exists) {
        setUsernameError('This username is already taken. Try another.');
        usernameRef.current?.focus();
        return;
      }
      if (emailResult.exists) {
        setEmailError('This email is already registered with Vialbum.');
        emailRef.current?.focus();
        return;
      }
      setForm((current) => ({ ...current, username, email }));
      setVerificationCode(Array(VERIFICATION_CODE_LENGTH).fill(''));
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('verification');
    } catch {
      if (checkId !== availabilityCheckId.current) return;
      setError('Unable to check account availability. Check your connection and try again.');
    } finally {
      if (checkId === availabilityCheckId.current) setIsSubmitting(false);
    }
  }

  function updateVerificationCode(index: number, value: string) {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setVerificationCode((current) => current.map((digit, digitIndex) => digitIndex === index ? '' : digit));
      setError(null);
      return;
    }

    setVerificationCode((current) => {
      const next = [...current];
      digits.slice(0, VERIFICATION_CODE_LENGTH - index).split('').forEach((digit, offset) => {
        next[index + offset] = digit;
      });
      return next;
    });
    setError(null);
    const nextIndex = Math.min(index + digits.length, VERIFICATION_CODE_LENGTH - 1);
    codeInputRefs.current[nextIndex]?.focus();
  }

  function handleCodeKeyPress(index: number, key: string) {
    if (key === 'Backspace' && !verificationCode[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  }

  function resendCode() {
    if (resendCooldown > 0) return;
    setVerificationCode(Array(VERIFICATION_CODE_LENGTH).fill(''));
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setResendFeedback('A new code has been sent.');
    codeInputRefs.current[0]?.focus();
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = setTimeout(() => setResendFeedback(null), 2400);
  }

  function changeEmail() {
    setVerificationCode(Array(VERIFICATION_CODE_LENGTH).fill(''));
    setError(null);
    setResendFeedback(null);
    setStep('form');
    emailFocusTimerRef.current = setTimeout(() => {
      emailFocusTimerRef.current = null;
      emailRef.current?.focus();
    }, 0);
  }

  async function verifyAndSubmit() {
    if (isSubmitting) return;
    if (!/^\d{6}$/.test(verificationCode.join(''))) {
      setError('Enter the complete 6-digit verification code.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await new Promise<void>((resolve) => {
        verificationDelayRef.current = setTimeout(() => {
          verificationDelayRef.current = null;
          resolve();
        }, VERIFICATION_DELAY_MS);
      });
      // TODO: Replace frontend-only verification with backend email OTP verification.
      if (!__DEV__) {
        setError('Email verification is not available yet.');
        return;
      }
      await signUp({ first_name: form.firstName.trim(), last_name: form.lastName.trim(), username: form.username.trim().toLowerCase(), email: form.email.trim().toLowerCase(), password: form.password });
      router.replace('/');
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.code === 'USERNAME_TAKEN') {
        setStep('form');
        setUsernameError('This username is already taken. Try another.');
        emailFocusTimerRef.current = setTimeout(() => usernameRef.current?.focus(), 0);
      } else if (caughtError instanceof ApiError && caughtError.code === 'EMAIL_ALREADY_REGISTERED') {
        setStep('form');
        setEmailError('This email is already registered with Vialbum.');
        emailFocusTimerRef.current = setTimeout(() => emailRef.current?.focus(), 0);
      } else {
        setError(authErrorMessage(caughtError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Animated.View shouldRasterizeIOS={false} style={markAnimation}><AuthVortexMark authColors={authColors} isDark={isDark} /></Animated.View>
            <Animated.View shouldRasterizeIOS={false} style={titleAnimation}><Text style={presentationTextStyle(styles.title)}>{step === 'form' ? 'Create your Vialbum' : 'Check your email'}</Text></Animated.View>
          </View>

          {step === 'form' ? <Animated.View shouldRasterizeIOS={false} style={[styles.formCard, formAnimation]}>
            <BlurView pointerEvents="none" tint={presentationBlurTint(isDark ? 'dark' : 'light')} intensity={isDark ? 38 : 28} style={StyleSheet.absoluteFill} />
            <TextInput accessibilityLabel="First name" autoCapitalize="words" keyboardAppearance={isDark ? 'dark' : 'light'} onChangeText={update('firstName')} onSubmitEditing={() => lastNameRef.current?.focus()} placeholder="First name" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="next" style={presentationTextStyle(styles.input)} textContentType="givenName" value={form.firstName} />
            <View style={styles.separator} />
            <TextInput ref={lastNameRef} accessibilityLabel="Last name" autoCapitalize="words" keyboardAppearance={isDark ? 'dark' : 'light'} onChangeText={update('lastName')} onSubmitEditing={() => usernameRef.current?.focus()} placeholder="Last name" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="next" style={presentationTextStyle(styles.input)} textContentType="familyName" value={form.lastName} />
            <View style={styles.separator} />
            <TextInput ref={usernameRef} accessibilityLabel="Username" autoCapitalize="none" autoComplete="username-new" autoCorrect={false} keyboardAppearance={isDark ? 'dark' : 'light'} onChangeText={update('username')} onSubmitEditing={() => emailRef.current?.focus()} placeholder="Choose a username" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="next" spellCheck={false} style={presentationTextStyle(styles.input)} textContentType="username" value={form.username} />
            {usernameError ? <Text accessibilityRole="alert" style={presentationTextStyle(styles.fieldError)}>{usernameError}</Text> : null}
            <View style={styles.separator} />
            <TextInput ref={emailRef} accessibilityLabel="Email address" autoCapitalize="none" autoCorrect={false} keyboardAppearance={isDark ? 'dark' : 'light'} keyboardType="email-address" onChangeText={update('email')} onSubmitEditing={() => passwordRef.current?.focus()} placeholder="Email address" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="next" style={presentationTextStyle(styles.input)} textContentType="emailAddress" value={form.email} />
            {emailError ? (
              <View style={styles.fieldErrorRow}>
                <Text style={presentationTextStyle(styles.fieldError)}>{emailError} </Text>
                <Link href={{ pathname: '/sign-in', params: { email: form.email.trim().toLowerCase() } }} asChild>
                  <Pressable hitSlop={8} style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}>
                    {({ pressed }) => <Text style={presentationTextStyle([styles.link, pressed && styles.linkPressed])}>Sign in instead</Text>}
                  </Pressable>
                </Link>
              </View>
            ) : null}
            <View style={styles.separator} />
            <View style={styles.inputRow}>
              <TextInput ref={passwordRef} accessibilityLabel="Password" autoCapitalize="none" autoComplete="new-password" autoCorrect={false} keyboardAppearance={isDark ? 'dark' : 'light'} onChangeText={update('password')} onSubmitEditing={() => confirmPasswordRef.current?.focus()} placeholder="Password · at least 8 characters" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="next" secureTextEntry={!isPasswordVisible} spellCheck={false} style={presentationTextStyle(styles.rowInput)} textContentType="newPassword" value={form.password} />
              <PasswordVisibilityToggle color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} isVisible={isPasswordVisible} onToggle={() => setIsPasswordVisible((current) => !current)} />
            </View>
            <View style={styles.separator} />
            <View style={styles.inputRow}>
              <TextInput ref={confirmPasswordRef} accessibilityLabel="Confirm password" autoCapitalize="none" autoComplete="new-password" autoCorrect={false} keyboardAppearance={isDark ? 'dark' : 'light'} onChangeText={update('confirmPassword')} onSubmitEditing={() => void continueToVerification()} placeholder="Confirm password" placeholderTextColor={resolvePresentationColor(authColors.placeholder, 'placeholderTextColor', 'control')} returnKeyType="go" secureTextEntry={!isConfirmPasswordVisible} spellCheck={false} style={presentationTextStyle(styles.rowInput)} textContentType="newPassword" value={form.confirmPassword} />
              <PasswordVisibilityToggle color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} isVisible={isConfirmPasswordVisible} onToggle={() => setIsConfirmPasswordVisible((current) => !current)} />
              <Pressable accessibilityLabel="Continue to email verification" accessibilityRole="button" accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }} disabled={isSubmitting} hitSlop={8} onPress={() => void continueToVerification()} style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, isSubmitting && styles.submitDisabled]}>
                {isSubmitting ? <ActivityIndicator size="small" color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} /> : <Ionicons name="arrow-forward" size={18} color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />}
              </Pressable>
            </View>
          </Animated.View> : (
            <Animated.View style={[styles.verification, verificationAnimation]}>
              <Text style={presentationTextStyle(styles.verificationIntro)}>We sent a 6-digit verification code to</Text>
              <Text style={presentationTextStyle(styles.verificationEmail)}>{form.email}</Text>
              <View style={styles.codeRow}>
                {verificationCode.map((digit, index) => (
                  <View key={index} style={styles.codeCell}>
                    <BlurView pointerEvents="none" tint={presentationBlurTint(isDark ? 'dark' : 'light')} intensity={isDark ? 38 : 28} style={StyleSheet.absoluteFill} />
                    <TextInput
                      ref={(input) => { codeInputRefs.current[index] = input; }}
                      accessibilityLabel={`Verification code digit ${index + 1}`}
                      autoComplete="one-time-code"
                      keyboardAppearance={isDark ? 'dark' : 'light'}
                      keyboardType="number-pad"
                      maxLength={VERIFICATION_CODE_LENGTH}
                      onChangeText={(value) => updateVerificationCode(index, value)}
                      onKeyPress={({ nativeEvent }) => handleCodeKeyPress(index, nativeEvent.key)}
                      selectTextOnFocus
                      style={presentationTextStyle(styles.codeInput)}
                      textContentType="oneTimeCode"
                      value={digit}
                    />
                  </View>
                ))}
              </View>
              <Pressable
                accessibilityLabel="Verify email and create account"
                accessibilityRole="button"
                accessibilityState={{ busy: isSubmitting, disabled: isSubmitting }}
                disabled={isSubmitting}
                onPress={() => void verifyAndSubmit()}
                style={({ pressed }) => [styles.verifyButton, pressed && styles.submitPressed, isSubmitting && styles.submitDisabled]}
              >
                {isSubmitting ? <ActivityIndicator size="small" color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} /> : <Ionicons name="arrow-forward" size={18} color={resolvePresentationColor(authColors.controlIcon, 'color', 'content')} />}
              </Pressable>
              <View style={styles.verificationLinks}>
                <Text style={presentationTextStyle(styles.footerText)}>Didn’t receive a code?</Text>
                <Pressable disabled={resendCooldown > 0} hitSlop={10} onPress={resendCode} style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}>
                  {({ pressed }) => <Text style={presentationTextStyle([styles.link, resendCooldown > 0 && styles.cooldownText, pressed && styles.linkPressed])}>{resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}</Text>}
                </Pressable>
              </View>
              {resendFeedback ? <Text accessibilityRole="alert" style={presentationTextStyle(styles.resendFeedback)}>{resendFeedback}</Text> : null}
              <Pressable hitSlop={10} onPress={changeEmail} style={({ pressed }) => [styles.changeEmailButton, pressed && styles.linkButtonPressed]}>
                {({ pressed }) => <Text style={presentationTextStyle([styles.link, pressed && styles.linkPressed])}>Change email</Text>}
              </Pressable>
            </Animated.View>
          )}

          {error ? <View style={styles.feedback}><ErrorBanner message={error} style={styles.errorBanner} textStyle={styles.errorText} /></View> : null}
          {step === 'form' ? <Animated.View shouldRasterizeIOS={false} style={[styles.footer, footerAnimation]}>
            <Text style={presentationTextStyle(styles.footerText)}>Already have an account?</Text>
            <Link href="/sign-in" asChild>
              <Pressable
                hitSlop={10}
                unstable_pressDelay={0}
                style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
              >
                {({ pressed }) => <Text style={presentationTextStyle([styles.link, pressed && styles.linkPressed])}>Sign in</Text>}
              </Pressable>
            </Link>
          </Animated.View> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(theme: AuthThemeColors, isDark: boolean) {
 return StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 120 },
  hero: { alignItems: 'center' },
  title: { color: theme.title, fontFamily: systemFont, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.9, marginTop: 32 },
  formCard: { marginTop: 32, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, borderRadius: 17, backgroundColor: theme.surface, overflow: 'hidden', shadowColor: theme.shadow, shadowOpacity: isDark ? 0.18 : 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 5 } },
  input: { minHeight: 58, paddingHorizontal: 17, paddingVertical: 14, color: theme.inputText, fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.1 },
  inputRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingLeft: 17, paddingRight: 10 },
  rowInput: { flex: 1, minHeight: 58, paddingVertical: 14, color: theme.inputText, fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.1 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: theme.separator, marginLeft: 17 },
  submit: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.control },
  submitPressed: { opacity: 0.62, transform: [{ scale: 0.96 }] },
  submitDisabled: { opacity: 0.45 },
  feedback: { marginTop: 16 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 28 },
  verification: { alignItems: 'center', marginTop: 26 },
  verificationIntro: { color: theme.body, fontFamily: systemFont, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: -0.1, textAlign: 'center' },
  verificationEmail: { color: theme.inputText, fontFamily: systemFont, fontSize: 16, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2, marginTop: 3 },
  codeRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 24 },
  codeCell: { flex: 1, height: 54, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, backgroundColor: theme.surface, overflow: 'hidden' },
  codeInput: { flex: 1, padding: 0, color: theme.inputText, fontFamily: systemFont, fontSize: 22, lineHeight: 26, fontWeight: '600', textAlign: 'center' },
  verifyButton: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.glassBorder, backgroundColor: theme.control, alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  verificationLinks: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 22 },
  cooldownText: { color: theme.body, opacity: 0.8 },
  resendFeedback: { color: theme.body, fontFamily: systemFont, fontSize: 12, lineHeight: 16, marginTop: 7 },
  changeEmailButton: { paddingHorizontal: 8, paddingVertical: 8, marginTop: 8 },
  errorBanner: { borderColor: theme.errorIcon, backgroundColor: theme.errorSurface },
  errorText: { color: theme.errorText, fontFamily: systemFont, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  fieldError: { color: theme.errorText, fontFamily: systemFont, fontSize: 12, lineHeight: 16, paddingHorizontal: 17, paddingBottom: 9 },
  fieldErrorRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', paddingRight: 12 },
  footerText: { color: theme.body, fontFamily: systemFont, fontSize: 14, lineHeight: 20, fontWeight: '400', letterSpacing: -0.1 },
  linkButton: { paddingHorizontal: 3, paddingVertical: 2 },
  linkButtonPressed: { transform: [{ scale: 0.96 }] },
  link: { color: theme.link, fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: -0.1, textDecorationLine: 'none' },
  linkPressed: { opacity: 0.55 },
});
}

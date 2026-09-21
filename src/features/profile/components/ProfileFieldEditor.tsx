import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { useProfileTheme } from '@/features/profile/theme';
import { systemFont } from '@/theme/tokens';

export type ProfileFieldKey = 'firstName' | 'lastName' | 'username' | 'bio' | 'location';

const FIELD_CONFIG: Record<ProfileFieldKey, {
  title: string;
  maxLength: number;
  placeholder: string;
  multiline?: boolean;
}> = {
  firstName: { title: 'First name', maxLength: 50, placeholder: 'First name' },
  lastName: { title: 'Last name', maxLength: 50, placeholder: 'Last name' },
  username: { title: 'Username', maxLength: 30, placeholder: 'Username' },
  bio: { title: 'Bio', maxLength: 150, placeholder: 'Share something about yourself…', multiline: true },
  location: { title: 'Location', maxLength: 100, placeholder: 'Location' },
};

function normalize(field: ProfileFieldKey, value: string) {
  const trimmed = value.trim();
  return field === 'username' ? trimmed.toLowerCase() : trimmed;
}

function validate(field: ProfileFieldKey, value: string) {
  if (field === 'firstName' && (!value || value.length > 50)) return 'First name must be between 1 and 50 characters.';
  if (field === 'lastName' && (!value || value.length > 50)) return 'Last name must be between 1 and 50 characters.';
  if (field === 'username' && !/^[a-z0-9_]{3,30}$/.test(value)) return 'Use 3–30 lowercase letters, numbers, or underscores.';
  if (field === 'bio' && value.length > 150) return 'Bio must be 150 characters or fewer.';
  if (field === 'location' && value.length > 100) return 'Location must be 100 characters or fewer.';
  return null;
}

export function ProfileFieldEditor({
  field,
  value,
  visible,
  onCancel,
  onConfirm,
}: {
  field: ProfileFieldKey | null;
  value: string;
  visible: boolean;
  onCancel: () => void;
  onConfirm: (field: ProfileFieldKey, value: string) => void;
}) {
  const theme = useProfileTheme();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setError(null);
  }, [field, value, visible]);

  if (!field) return null;
  const config = FIELD_CONFIG[field];
  const changed = draft !== value;

  function requestClose() {
    if (!changed) { onCancel(); return; }
    Alert.alert('Discard Changes?', 'Your profile changes haven’t been saved.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard Changes', style: 'destructive', onPress: onCancel },
    ]);
  }

  function confirm() {
    const nextValue = normalize(field!, draft);
    const nextError = validate(field!, nextValue);
    if (nextError) { setError(nextError); return; }
    onConfirm(field!, nextValue);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" hitSlop={6} onPress={requestClose} style={({ pressed }) => [styles.headerButton, styles.backButton, { backgroundColor: theme.glassStrong, borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="chevron-back" size={25} color={theme.ink} />
          </Pressable>
          <Text style={[styles.title, { color: theme.ink }]}>{config.title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`Save ${config.title}`} hitSlop={6} onPress={confirm} style={({ pressed }) => [styles.headerButton, styles.confirmButton, { backgroundColor: theme.glassStrong, borderColor: theme.border }, pressed && styles.pressed]}>
            <Ionicons name="checkmark" size={26} color={theme.accent} />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={styles.body} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.inputShell, config.multiline && styles.bioShell, { backgroundColor: theme.glassStrong, borderColor: error ? theme.danger : theme.border }]}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={(text) => { setDraft(field === 'username' ? text.toLowerCase() : text); setError(null); }}
              maxLength={config.maxLength}
              multiline={config.multiline}
              autoCapitalize={field === 'username' ? 'none' : field === 'bio' ? 'sentences' : 'words'}
              autoCorrect={field !== 'username'}
              placeholder={config.placeholder}
              placeholderTextColor={theme.subtle}
              returnKeyType={config.multiline ? 'default' : 'done'}
              onSubmitEditing={config.multiline ? undefined : confirm}
              style={[styles.input, config.multiline && styles.bioInput, { color: theme.ink }]}
              textAlignVertical={config.multiline ? 'top' : 'center'}
            />
            {draft ? <Pressable accessibilityRole="button" accessibilityLabel={`Clear ${config.title}`} hitSlop={8} onPress={() => { setDraft(''); setError(null); }} style={({ pressed }) => [styles.clearButton, config.multiline && styles.bioClear, pressed && styles.pressed]}><Ionicons name="close-circle" size={20} color={theme.muted} /></Pressable> : null}
            {config.multiline ? <Text style={[styles.counter, { color: draft.length >= 140 ? theme.danger : theme.muted }]}>{draft.length}/150</Text> : null}
          </View>
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { height: 46, marginTop: 8, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  headerButton: { position: 'absolute', width: 46, height: 46, borderRadius: 23, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#000000', shadowOpacity: 0.07, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  backButton: { left: 8 },
  confirmButton: { right: 8 },
  title: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.35 },
  body: { flex: 1, paddingTop: 22, paddingHorizontal: 18 },
  inputShell: { minHeight: 54, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingLeft: 15, paddingRight: 6 },
  bioShell: { height: 154, alignItems: 'flex-start', paddingTop: 12, paddingBottom: 30 },
  input: { flex: 1, minHeight: 52, paddingVertical: 12, paddingRight: 4, fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400' },
  bioInput: { height: 110, paddingTop: 0, paddingRight: 34 },
  clearButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  bioClear: { position: 'absolute', right: 4, top: 4 },
  counter: { position: 'absolute', right: 13, bottom: 9, fontFamily: systemFont, fontSize: 11, lineHeight: 15 },
  error: { marginTop: 8, marginHorizontal: 4, fontFamily: systemFont, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.5, transform: [{ scale: 0.96 }] },
});

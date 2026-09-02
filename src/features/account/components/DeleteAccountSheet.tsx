import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DestructiveButton, SecondaryButton } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/Feedback';
import { SheetHeader } from '@/components/ui/Headers';
import { TextField } from '@/components/ui/TextField';
import { accountDeletionError, canDeleteAccount } from '@/features/account/config';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

type Props = { visible: boolean; onClose: () => void; onDelete: (password: string) => Promise<void> };

export function DeleteAccountSheet({ visible, onClose, onDelete }: Props) {
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    if (pending) return;
    setConfirmation(''); setPassword(''); setError(null); onClose();
  };
  const remove = async () => {
    if (!canDeleteAccount(confirmation, password, pending)) return;
    setPending(true); setError(null);
    try {
      await onDelete(password);
      setConfirmation(''); setPassword('');
    } catch (caught) {
      setError(accountDeletionError(caught));
    } finally {
      setPending(false);
    }
  };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
    <KeyboardAvoidingView style={styles.safe} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <SheetHeader title="Delete Account" onClose={close} />
        <View style={styles.warning}>
          <Text style={styles.eyebrow}>PERMANENT ACTION</Text>
          <Text style={styles.title}>Delete your Vialbum forever?</Text>
          <Text style={styles.copy}>Your journeys, memories, photo records, and private uploaded media will be permanently removed. This cannot be undone. Export your data first if you want a copy.</Text>
        </View>
        <TextField label="Type DELETE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" contained />
        <TextField label="Current password" value={password} onChangeText={setPassword} secureTextEntry contained />
        {error ? <ErrorBanner message={error} /> : null}
        <DestructiveButton accessibilityLabel="Permanently delete my Vialbum account" disabled={!canDeleteAccount(confirmation, password, pending)} loading={pending} onPress={() => void remove()}>Delete My Account</DestructiveButton>
        <SecondaryButton disabled={pending} onPress={close}>Keep My Account</SecondaryButton>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, gap: spacing.lg },
  warning: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: '#F5E9E4', gap: spacing.sm },
  eyebrow: { ...typography.eyebrow, color: colors.danger }, title: { ...typography.sectionTitle, color: colors.ink }, copy: { ...typography.body, color: colors.muted },
});

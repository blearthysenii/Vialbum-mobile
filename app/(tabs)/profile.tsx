import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { accountLinks, validPublicUrl } from '@/features/account/config';
import { DeleteAccountSheet } from '@/features/account/components/DeleteAccountSheet';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import type { ExportState } from '@/features/exports/utils';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
import { DestructiveButton, SecondaryButton } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/Headers';
import { MetadataRow } from '@/components/ui/Metadata';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, typography } from '@/theme/tokens';

export default function ProfileScreen() {
  const tabBarScroll = useTabBarScroll();
  const { user, signOut, deleteAccount } = useAuth();
  const initials = `${user?.first_name[0] ?? ''}${user?.last_name[0] ?? ''}`.toUpperCase();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [showDelete, setShowDelete] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const version = Constants.expoConfig?.version ?? 'Unknown';
  const build = Constants.nativeBuildVersion;

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/sign-in');
    } finally {
      setSigningOut(false);
    }
  }

  async function exportAccount() {
    try {
      await exportApi.account(setExportState);
    } catch (caught) {
      Alert.alert('Export unavailable', caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setExportState('idle');
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView {...tabBarScroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader eyebrow="YOUR SPACE" title="Profile" />
        <View style={styles.profile}><View style={styles.avatar}><Text style={styles.initial}>{initials || 'V'}</Text></View>
          <Text style={styles.title}>{user?.first_name} {user?.last_name}</Text><Text style={styles.copy}>A quiet home for the places and moments you want to keep.</Text>
        </View>
        <View style={styles.details}><MetadataRow label="Email" value={user?.email ?? '—'} /></View>
        <View style={styles.exportCard}>
          <Text style={styles.exportTitle}>Your data belongs to you.</Text>
          <Text style={styles.exportCopy}>Download a portable ZIP containing your account, journeys, memories, media details, and saved places. Photo files are available through individual journey exports.</Text>
          <SecondaryButton accessibilityLabel="Export my Vialbum account data" disabled={exportState !== 'idle'} onPress={() => void exportAccount()}>Export My Data</SecondaryButton>
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <MetadataRow label="Version" value={`${version}${build ? ` (${build})` : ''}`} />
          {validPublicUrl(accountLinks.privacy) ? <Pressable accessibilityRole="link" accessibilityLabel="Open Vialbum privacy policy" onPress={() => void Linking.openURL(accountLinks.privacy!)} style={styles.link}><Text style={styles.linkText}>Privacy Policy</Text></Pressable> : null}
          {validPublicUrl(accountLinks.terms) ? <Pressable accessibilityRole="link" accessibilityLabel="Open Vialbum terms" onPress={() => void Linking.openURL(accountLinks.terms!)} style={styles.link}><Text style={styles.linkText}>Terms</Text></Pressable> : null}
          {!validPublicUrl(accountLinks.privacy) || !validPublicUrl(accountLinks.terms) ? <Text style={styles.pendingLinks}>Privacy and terms links will appear when configured for release.</Text> : null}
        </View>
        <View style={styles.actions}>
          <SecondaryButton accessibilityLabel="Sign out of Vialbum" disabled={exportState !== 'idle'} loading={signingOut} onPress={() => void logout()}>Sign Out</SecondaryButton>
          <DestructiveButton accessibilityLabel="Open permanent account deletion" onPress={() => setShowDelete(true)}>Delete Account</DestructiveButton>
        </View>
      </ScrollView>
      <ExportProgress state={exportState} />
      <DeleteAccountSheet visible={showDelete} onClose={() => setShowDelete(false)} onDelete={async (password) => {
        await deleteAccount(password);
        setShowDelete(false);
        router.replace('/sign-in');
      }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.canvas }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, profile: { alignItems: 'center', marginTop: spacing.xxl }, avatar: { width: 88, height: 88, borderRadius: radii.round, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.canvas, fontSize: 27, fontWeight: '800' }, title: { ...typography.screenTitle, marginTop: spacing.lg, color: colors.ink }, copy: { ...typography.bodyLarge, maxWidth: 300, marginTop: spacing.md, textAlign: 'center', color: colors.muted }, details: { marginTop: spacing.xxl }, exportCard: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: colors.surfaceWarm, gap: spacing.md }, exportTitle: { ...typography.cardTitle, color: colors.ink }, exportCopy: { ...typography.body, color: colors.muted }, section: { marginTop: spacing.xl, gap: spacing.md }, sectionTitle: { ...typography.sectionTitle, color: colors.ink }, link: { minHeight: 44, justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: colors.line }, linkText: { ...typography.button, color: colors.accent }, pendingLinks: { ...typography.metadata, color: colors.muted }, actions: { marginTop: spacing.xl, gap: spacing.md } });

import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { accountLinks, validPublicUrl } from '@/features/account/config';
import { DeleteAccountSheet } from '@/features/account/components/DeleteAccountSheet';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import type { ExportState } from '@/features/exports/utils';
import { useTabBarScroll } from '@/features/navigation/TabBarScrollContext';
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
        <View style={styles.header}><Text style={styles.headerTitle}>Profile</Text></View>
        <View style={styles.profile}>
          <BlurView pointerEvents="none" intensity={40} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.glassTint} />
          <View style={styles.avatar}><Text style={styles.initial}>{initials || 'V'}</Text></View>
          <View style={styles.identity}><Text style={styles.title}>{user?.first_name} {user?.last_name}</Text><Text numberOfLines={1} style={styles.email}>{user?.email ?? '—'}</Text></View>
        </View>

        <Text style={styles.sectionLabel}>YOUR VIALBUM</Text>
        <View style={styles.glassGroup}>
          <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.glassTint} />
          <Pressable accessibilityRole="button" accessibilityLabel="Export my Vialbum account data" disabled={exportState !== 'idle'} onPress={() => void exportAccount()} style={({ pressed }) => [styles.featureRow, pressed && styles.pressed]}>
            <View style={styles.iconWell}><Ionicons name="arrow-down-circle-outline" size={21} color={colors.accent} /></View>
            <View style={styles.rowCopy}><Text style={styles.rowTitle}>Export My Data</Text><Text style={styles.rowSubtitle}>Download your journeys, memories, and saved places.</Text></View>
            {exportState !== 'idle' ? <ActivityIndicator size="small" color={colors.muted} /> : <Ionicons name="chevron-forward" size={17} color={colors.subtle} />}
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.glassGroup}>
          <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.glassTint} />
          <View style={styles.settingRow}><View style={styles.iconWell}><Ionicons name="information-circle-outline" size={21} color={colors.muted} /></View><Text style={styles.settingTitle}>Version</Text><Text style={styles.settingValue}>{version}{build ? ` (${build})` : ''}</Text></View>
          {validPublicUrl(accountLinks.privacy) ? <><View style={styles.divider} /><Pressable accessibilityRole="link" accessibilityLabel="Open Vialbum privacy policy" onPress={() => void Linking.openURL(accountLinks.privacy!)} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.iconWell}><Ionicons name="shield-checkmark-outline" size={20} color={colors.muted} /></View><Text style={styles.settingTitle}>Privacy Policy</Text><Ionicons name="chevron-forward" size={17} color={colors.subtle} /></Pressable></> : null}
          {validPublicUrl(accountLinks.terms) ? <><View style={styles.divider} /><Pressable accessibilityRole="link" accessibilityLabel="Open Vialbum terms" onPress={() => void Linking.openURL(accountLinks.terms!)} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.iconWell}><Ionicons name="document-text-outline" size={20} color={colors.muted} /></View><Text style={styles.settingTitle}>Terms</Text><Ionicons name="chevron-forward" size={17} color={colors.subtle} /></Pressable></> : null}
          {!validPublicUrl(accountLinks.privacy) || !validPublicUrl(accountLinks.terms) ? <Text style={styles.pendingLinks}>Privacy and terms links will appear when configured for release.</Text> : null}
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.glassGroup}>
          <BlurView pointerEvents="none" intensity={38} tint="systemUltraThinMaterialLight" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.glassTint} />
          <Pressable accessibilityRole="button" accessibilityLabel="Sign out of Vialbum" disabled={exportState !== 'idle' || signingOut} onPress={() => void logout()} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={styles.iconWell}><Ionicons name="log-out-outline" size={20} color={colors.ink} /></View><Text style={styles.settingTitle}>Sign Out</Text>{signingOut ? <ActivityIndicator size="small" color={colors.muted} /> : null}</Pressable>
          <View style={styles.divider} />
          <Pressable accessibilityRole="button" accessibilityLabel="Open permanent account deletion" onPress={() => setShowDelete(true)} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed]}><View style={[styles.iconWell, styles.dangerWell]}><Ionicons name="trash-outline" size={20} color={colors.danger} /></View><Text style={styles.dangerText}>Delete Account</Text></Pressable>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas }, content: { paddingHorizontal: spacing.screen, paddingTop: 4, paddingBottom: 140 },
  header: { minHeight: 54, justifyContent: 'center' }, headerTitle: { ...typography.screenTitle, color: colors.ink, fontSize: 32, lineHeight: 37 },
  profile: { minHeight: 94, marginTop: 8, borderRadius: 26, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 15, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.62)' },
  glassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.10)' }, avatar: { width: 62, height: 62, borderRadius: radii.round, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, initial: { color: colors.canvas, fontSize: 21, fontWeight: '800' }, identity: { flex: 1, minWidth: 0 }, title: { ...typography.cardTitle, color: colors.ink, fontSize: 20 }, email: { ...typography.body, color: colors.muted, marginTop: 3 },
  sectionLabel: { ...typography.eyebrow, color: colors.muted, fontSize: 10, marginTop: 26, marginBottom: 8, paddingHorizontal: 5 },
  glassGroup: { borderRadius: 22, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.28)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.58)' },
  featureRow: { minHeight: 78, paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 12 }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { ...typography.button, color: colors.ink, fontSize: 16 }, rowSubtitle: { ...typography.metadata, color: colors.muted, fontWeight: '400', lineHeight: 17, marginTop: 3 },
  settingRow: { minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, iconWell: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(118,118,128,0.10)' }, settingTitle: { ...typography.body, color: colors.ink, fontSize: 16, flex: 1 }, settingValue: { ...typography.metadata, color: colors.muted, fontWeight: '500' }, divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(113,111,104,0.18)', marginLeft: 60 }, pressed: { opacity: 0.58 },
  pendingLinks: { ...typography.metadata, color: colors.muted, paddingHorizontal: 15, paddingVertical: 12 }, dangerWell: { backgroundColor: 'rgba(163,61,45,0.09)' }, dangerText: { ...typography.body, color: colors.danger, fontSize: 16, flex: 1 },
});

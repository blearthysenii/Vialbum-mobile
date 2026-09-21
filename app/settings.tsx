import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { accountLinks, validPublicUrl } from '@/features/account/config';
import { DeleteAccountSheet } from '@/features/account/components/DeleteAccountSheet';
import { useAuth } from '@/features/auth/AuthProvider';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import type { ExportState } from '@/features/exports/utils';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { memoryApi } from '@/features/memories/api';
import { TravelStatsCard } from '@/features/profile/components/TravelProfileContent';
import { useProfileTheme } from '@/features/profile/theme';
import type { ProfileJourney } from '@/features/profile/types';

export default function SettingsScreen() {
  const theme = useProfileTheme();
  const { signOut, deleteAccount } = useAuth();
  const { journeys } = useJourneys();
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [showDelete, setShowDelete] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [summaryJourneys, setSummaryJourneys] = useState<ProfileJourney[]>([]);
  const [signingOut, setSigningOut] = useState(false);
  const version = Constants.expoConfig?.version ?? 'Unknown';
  const build = Constants.nativeBuildVersion;
  useEffect(() => {
    let active = true;
    setSummaryJourneys(journeys.map((journey) => ({ ...journey, memories: [], media: [] })));
    if (!journeys.length) { setLoadingSummary(false); return; }
    setLoadingSummary(true);
    void Promise.allSettled(journeys.map((journey) => memoryApi.list(journey.id))).then((results) => {
      if (!active) return;
      setSummaryJourneys(journeys.map((journey, index) => ({
        ...journey,
        memories: results[index].status === 'fulfilled' ? results[index].value : [],
        media: [],
      })));
    }).finally(() => { if (active) setLoadingSummary(false); });
    return () => { active = false; };
  }, [journeys]);
  const totalMemories = useMemo(() => summaryJourneys.reduce((sum, journey) => sum + journey.memories.length, 0), [summaryJourneys]);
  async function logout(saveAccount: boolean) {
    if (signingOut) return;
    setSigningOut(true);
    try { await signOut(saveAccount); router.replace('/sign-in'); }
    catch { Alert.alert('Unable to sign out', 'Please try again. If saving fails, choose Don’t Save to sign out.'); }
    finally { setSigningOut(false); }
  }
  function confirmLogout() {
    if (signingOut) return;
    Alert.alert('Do you want to save this account on this device?',
      'Saving lets anyone with access to this unlocked device sign in while your session is valid. Your password is never saved.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Don’t Save', style: 'destructive', onPress: () => void logout(false) },
        { text: 'Save', onPress: () => void logout(true) },
      ]);
  }
  async function exportAccount() { try { await exportApi.account(setExportState); } catch (error) { Alert.alert('Export unavailable', error instanceof Error ? error.message : 'Please try again.'); } finally { setExportState('idle'); } }
  const groupStyle = [styles.group, { backgroundColor: theme.glass, borderColor: theme.border }];
  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, onPress?: () => void, trailing?: React.ReactNode, danger = false) => <Pressable disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={[styles.iconWell, { backgroundColor: theme.glassStrong }]}><Ionicons name={icon} size={20} color={danger ? theme.danger : theme.ink} /></View><Text style={[styles.rowText, { color: danger ? theme.danger : theme.ink }]}>{title}</Text>{trailing}</Pressable>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: theme.canvas }]}>
    <View style={styles.nav}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Ionicons name="chevron-back" size={25} color={theme.ink} /></Pressable><Text style={[styles.navTitle, { color: theme.ink }]}>Settings</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={[styles.label, { color: theme.muted }]}>YOUR TRAVEL</Text><View style={groupStyle}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />{row('book-outline', 'Travel summary', () => setShowSummary((value) => !value), loadingSummary ? <ActivityIndicator color={theme.muted} /> : <Ionicons name={showSummary ? 'chevron-up' : 'chevron-forward'} size={17} color={theme.subtle} />)}</View>
      {showSummary && !loadingSummary ? <View style={styles.summaryDetails}><TravelStatsCard journeys={summaryJourneys} totalMemories={totalMemories} theme={theme} /></View> : null}
      <Text style={[styles.label, { color: theme.muted }]}>YOUR VIALBUM</Text><View style={groupStyle}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />{row('arrow-down-circle-outline', 'Export My Data', () => void exportAccount(), exportState !== 'idle' ? <ActivityIndicator color={theme.muted} /> : <Ionicons name="chevron-forward" size={17} color={theme.subtle} />)}</View>
      <Text style={[styles.label, { color: theme.muted }]}>ABOUT</Text><View style={groupStyle}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />{row('information-circle-outline', 'Version', undefined, <Text style={[styles.value, { color: theme.muted }]}>{version}{build ? ` (${build})` : ''}</Text>)}{validPublicUrl(accountLinks.privacy) ? <><View style={[styles.divider, { backgroundColor: theme.divider }]} />{row('shield-checkmark-outline', 'Privacy Policy', () => void Linking.openURL(accountLinks.privacy!), <Ionicons name="chevron-forward" size={17} color={theme.subtle} />)}</> : null}{validPublicUrl(accountLinks.terms) ? <><View style={[styles.divider, { backgroundColor: theme.divider }]} />{row('document-text-outline', 'Terms', () => void Linking.openURL(accountLinks.terms!), <Ionicons name="chevron-forward" size={17} color={theme.subtle} />)}</> : null}</View>
      <Text style={[styles.label, { color: theme.muted }]}>ACCOUNT</Text><View style={groupStyle}><BlurView pointerEvents="none" intensity={theme.dark ? 34 : 24} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />{row('log-out-outline', 'Sign Out', confirmLogout, signingOut ? <ActivityIndicator color={theme.muted} /> : null)}<View style={[styles.divider, { backgroundColor: theme.divider }]} />{row('trash-outline', 'Delete Account', () => setShowDelete(true), null, true)}</View>
    </ScrollView>
    <ExportProgress state={exportState} /><DeleteAccountSheet visible={showDelete} onClose={() => setShowDelete(false)} onDelete={async (password) => { await deleteAccount(password); setShowDelete(false); router.replace('/sign-in'); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, nav: { height: 52, alignItems: 'center', justifyContent: 'center' }, back: { position: 'absolute', left: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, navTitle: { fontFamily: 'System', fontSize: 17, fontWeight: '700' }, content: { paddingHorizontal: 18, paddingBottom: 40 }, label: { fontSize: 10, lineHeight: 14, fontWeight: '700', letterSpacing: 1.1, marginTop: 24, marginBottom: 8, paddingHorizontal: 5 }, group: { borderRadius: 22, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth }, row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }, iconWell: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, rowText: { flex: 1, fontSize: 16, lineHeight: 21, fontWeight: '400' }, value: { fontSize: 12, fontWeight: '500' }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 }, summaryDetails: { marginTop: 12, marginHorizontal: -20 }, pressed: { opacity: 0.52, transform: [{ scale: 0.985 }] } });

import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { appearanceStore, useAppearancePreference, type AppearancePreference } from '@/theme/appearance';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const { preference } = useAppearancePreference();
  const [showAppearance, setShowAppearance] = useState(false);
  const chooseAppearance = (value: AppearancePreference) => {
    void appearanceStore.set(value).catch(() => Alert.alert('Appearance not saved', 'Your selection applies now, but could not be saved. Please try again.'));
  };
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
    if (!showSummary) return;
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
  }, [journeys, showSummary]);
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
  const groupStyle = [styles.group, { backgroundColor: theme.groupedSurface }];
  const chevron = <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />;
  const divider = <View style={[styles.divider, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />;
  const row = (icon: keyof typeof Ionicons.glyphMap, title: string, onPress?: () => void, trailing?: React.ReactNode, danger = false, disabled = false) => <Pressable disabled={!onPress || disabled} accessibilityLabel={title} accessibilityState={{ disabled: disabled || !onPress }} accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => [styles.row, (pressed || disabled) && styles.pressed]}><View style={styles.iconWell}><Ionicons name={icon} size={20} color={resolvePresentationColor(danger ? theme.danger : theme.ink, 'color', 'content')} /></View><Text style={presentationTextStyle([styles.rowText, { color: resolvePresentationColor(danger ? theme.danger : theme.ink, 'color', 'surface') }])}>{title}</Text>{trailing === undefined && onPress ? chevron : trailing}</Pressable>;
  return <SafeAreaView style={[styles.safe, { backgroundColor: resolvePresentationColor(theme.groupedCanvas, 'backgroundColor', 'canvas') }]}>
    <View style={styles.nav}><Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && styles.pressed]}><Ionicons name="chevron-back" size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable><Text style={presentationTextStyle([styles.navTitle, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Settings</Text></View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>YOUR VIALBUM</Text>
      <View style={groupStyle}>
        {row('person-outline', 'Edit profile', () => router.push('/edit-profile'))}{divider}
        {row('bookmark-outline', 'Saved', () => router.push('/saved-journeys'))}{divider}
        {row('images-outline', 'Saved Moments', () => router.push('/saved-moments'))}{divider}
        {row('document-text-outline', 'Drafts', () => router.push('/journey/drafts'))}
      </View>
      <Text style={presentationTextStyle([styles.label, { color: theme.muted }])}>APPEARANCE</Text>
      <View style={groupStyle}>
        {row('contrast-outline', 'Appearance', () => setShowAppearance(value => !value), <Text style={presentationTextStyle([styles.value, { color: theme.muted }])}>{preference === 'system' ? 'System' : preference === 'dark' ? 'Dark' : 'Light'}</Text>)}
        {showAppearance ? (['system', 'light', 'dark'] as const).map(value => <View key={value}>{divider}<Pressable accessibilityRole="radio" accessibilityState={{ checked: preference === value }} accessibilityLabel={`${value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'} appearance`} onPress={() => chooseAppearance(value)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.iconWell}><Ionicons name={value === 'system' ? 'phone-portrait-outline' : value === 'light' ? 'sunny-outline' : 'moon-outline'} size={20} color={theme.ink} /></View><Text style={presentationTextStyle([styles.rowText, { color: theme.ink }])}>{value === 'system' ? 'System' : value === 'light' ? 'Light' : 'Dark'}</Text>{preference === value ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}</Pressable></View>) : null}
      </View>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>YOUR TRAVEL</Text><View style={groupStyle}>{row('book-outline', 'Travel summary', () => setShowSummary((value) => !value), loadingSummary ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <Ionicons name={showSummary ? 'chevron-up' : 'chevron-forward'} size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />)}</View>
      {showSummary && !loadingSummary ? <View style={styles.summaryDetails}><TravelStatsCard journeys={summaryJourneys} totalMemories={totalMemories} theme={theme} /></View> : null}
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>YOUR DATA</Text><View style={groupStyle}>{row('arrow-down-circle-outline', 'Export my data', () => void exportAccount(), exportState !== 'idle' ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />, false, exportState !== 'idle')}</View>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>ABOUT</Text><View style={groupStyle}>{row('information-circle-outline', 'Version', undefined, <Text style={presentationTextStyle([styles.value, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{version}{build ? ` (${build})` : ''}</Text>)}{validPublicUrl(accountLinks.privacy) ? <><View style={[styles.divider, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />{row('shield-checkmark-outline', 'Privacy Policy', () => void Linking.openURL(accountLinks.privacy!), <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />)}</> : null}{validPublicUrl(accountLinks.terms) ? <><View style={[styles.divider, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} />{row('document-text-outline', 'Terms', () => void Linking.openURL(accountLinks.terms!), <Ionicons name="chevron-forward" size={17} color={resolvePresentationColor(theme.subtle, 'color', 'content')} />)}</> : null}</View>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>ACCOUNT ACTIONS</Text>
      <View style={groupStyle}>{row('log-out-outline', 'Log out', confirmLogout, signingOut ? <ActivityIndicator color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : null, false, signingOut)}</View>
      <View style={[groupStyle, styles.deleteGroup]}>{row('trash-outline', 'Delete account', () => setShowDelete(true), null, true, signingOut)}</View>
    </ScrollView>
    <ExportProgress state={exportState} /><DeleteAccountSheet visible={showDelete} onClose={() => setShowDelete(false)} onDelete={async (password) => { await deleteAccount(password); setShowDelete(false); router.replace('/sign-in'); }} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, nav: { height: 52, alignItems: 'center', justifyContent: 'center' }, back: { position: 'absolute', left: 8, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, navTitle: { fontFamily: 'System', fontSize: 17, fontWeight: '700' }, content: { paddingHorizontal: 18, paddingBottom: 40 }, label: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: .5, marginTop: 24, marginBottom: 8, paddingHorizontal: 5 }, group: { borderRadius: 16, overflow: 'hidden' }, row: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }, iconWell: { width: 28, height: 32, alignItems: 'center', justifyContent: 'center' }, rowText: { flex: 1, fontSize: 17, lineHeight: 22, fontWeight: '400' }, value: { fontSize: 14, fontWeight: '500' }, divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 }, summaryDetails: { marginTop: 12, marginHorizontal: -20 }, deleteGroup: { marginTop: 12 }, pressed: { opacity: 0.52 } });
const presentationBaselineStyles = styles;

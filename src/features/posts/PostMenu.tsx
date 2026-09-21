import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { useSavedJourneys } from '@/features/savedJourneys/useSavedJourneys';
import { exportApi } from '@/features/exports/api';
import { ExportProgress } from '@/features/exports/components/ExportProgress';
import { safeExportFilename, type ExportState } from '@/features/exports/utils';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PostJourney } from './data';
import { PostGlassButton } from './PostGlassButton';

export function PostMenu({ journey, owner, theme }: { journey: PostJourney; owner: boolean; theme: ProfileTheme }) {
  const { remove } = useJourneys();
  const { entries, toggle } = useSavedJourneys();
  const [open, setOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [deleting, setDeleting] = useState(false);
  const saved = entries.get(journey.id);
  const edit = (action?: string) => router.push({ pathname: '/journey/edit/[id]', params: { id: journey.id, ...(action ? { action } : {}) } });
  async function runExport(includeMedia: boolean) {
    try { await exportApi.journey(journey.id, includeMedia, safeExportFilename(journey.title, journey.start_date.slice(0, 4)), setExportState); }
    catch (e) { Alert.alert('Export unavailable', e instanceof Error ? e.message : 'Please try again.'); }
    finally { setExportState('idle'); }
  }
  const actions = owner ? [
    { title: 'Edit Post', run: () => edit() },
    { title: 'Add Photos', run: () => edit('add') },
    { title: 'Change Cover', run: () => edit('cover') },
    { title: 'Export Journey', run: () => Alert.alert('Export Journey', 'Create a private, portable ZIP with your journey data.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Data Only', onPress: () => void runExport(false) }, { text: 'Data + Photos', onPress: () => void runExport(true) },
    ]) },
    { title: 'Delete Journey', run: () => Alert.alert('Delete this journey?', 'This album and its memories will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => {
        setDeleting(true);
        void remove(journey.id).then(() => { if (router.canGoBack()) router.back(); else router.replace('/'); })
          .catch(e => Alert.alert('Could not delete journey', e instanceof Error ? e.message : 'Please try again.'))
          .finally(() => setDeleting(false));
      } },
    ]) },
  ] : [{ title: (saved?.saved ?? journey.is_saved) ? 'Remove from Saved' : 'Save Journey', run: () => { void toggle(journey.id, journey.is_saved ?? false); } }];
  const show = () => {
    if (deleting || exportState !== 'idle' || saved?.pending) return;
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ options: [...actions.map(a => a.title), 'Cancel'], cancelButtonIndex: actions.length, ...(owner ? { destructiveButtonIndex: actions.length - 1 } : {}) }, index => actions[index]?.run());
    else setOpen(true);
  };
  return <>
    <PostGlassButton theme={theme} label="Post options" onPress={show}><Ionicons name="ellipsis-horizontal" size={23} color={theme.ink} /></PostGlassButton>
    {saved?.error ? <Text accessibilityRole="alert" style={{ position: 'absolute', right: 16, top: 50, color: theme.danger, backgroundColor: theme.canvas }}>{saved.error}</Text> : null}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }}>
        <Pressable accessibilityLabel="Dismiss menu" style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <SafeAreaView style={{ backgroundColor: theme.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
          {actions.map(action => <Pressable key={action.title} accessibilityRole="button" onPress={() => { setOpen(false); action.run(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: action.title === 'Delete Journey' ? theme.danger : theme.ink, fontSize: 17 }}>{action.title}</Text></Pressable>)}
          <Pressable onPress={() => setOpen(false)} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.muted }}>Cancel</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>
    <ExportProgress state={exportState} />
  </>;
}

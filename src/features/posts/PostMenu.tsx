import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { useSavedJourneys } from '@/features/savedJourneys/useSavedJourneys';
import type { ProfileTheme } from '@/features/profile/theme';
import type { PostJourney } from './data';
import { PostGlassButton } from './PostGlassButton';

export function PostMenu({ journey, owner, theme }: { journey: PostJourney; owner: boolean; theme: ProfileTheme }) {
  const { remove } = useJourneys();
  const { entries, toggle } = useSavedJourneys();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const saved = entries.get(journey.id);
  const edit = () => router.push({ pathname: '/journey/edit/[id]', params: { id: journey.id } });
  const actions = owner ? [
    { title: 'Edit Post', run: () => edit() },
    { title: 'Delete Journey', run: () => Alert.alert('Delete journey?', 'This will permanently remove the journey and its associated content.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete Journey', style: 'destructive', onPress: () => {
        setDeleting(true);
        void remove(journey.id).then(() => { if (router.canGoBack()) router.back(); else router.replace('/'); })
          .catch(e => Alert.alert('Could not delete journey', e instanceof Error ? e.message : 'Please try again.'))
          .finally(() => setDeleting(false));
      } },
    ]) },
  ] : [{ title: (saved?.saved ?? journey.is_saved) ? 'Remove from Saved' : 'Save Journey', run: () => { void toggle(journey.id, journey.is_saved ?? false); } }];
  const show = () => {
    if (deleting || saved?.pending) return;
    if (Platform.OS === 'ios') ActionSheetIOS.showActionSheetWithOptions({ userInterfaceStyle: theme.dark ? 'dark' : 'light', options: [...actions.map(a => a.title), 'Cancel'], cancelButtonIndex: actions.length, ...(owner ? { destructiveButtonIndex: actions.length - 1 } : {}) }, index => actions[index]?.run());
    else setOpen(true);
  };
  return <>
    <PostGlassButton theme={theme} label="Post options" onPress={show}><Ionicons name="ellipsis-horizontal" size={23} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></PostGlassButton>
    {saved?.error ? <Text accessibilityRole="alert" style={presentationTextStyle({ position: 'absolute', right: 16, top: 50, color: resolvePresentationColor(theme.danger, 'color', 'content'), backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface') })}>{saved.error}</Text> : null}
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: resolvePresentationColor('rgba(0,0,0,0.35)', 'backgroundColor', 'content') }}>
        <Pressable accessibilityLabel="Dismiss menu" style={{ flex: 1 }} onPress={() => setOpen(false)} />
        <SafeAreaView style={{ backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface'), borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 }}>
          {actions.map(action => <Pressable key={action.title} accessibilityRole="button" onPress={() => { setOpen(false); action.run(); }} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(action.title === 'Delete Journey' ? theme.danger : theme.ink, 'color', 'content'), fontSize: 17 })}>{action.title}</Text></Pressable>)}
          <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={{ minHeight: 48, justifyContent: 'center', marginTop: 8, borderTopWidth: 0.5, borderTopColor: resolvePresentationColor(theme.divider, 'borderTopColor', 'control') }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 17 })}>Cancel</Text></Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  </>;
}

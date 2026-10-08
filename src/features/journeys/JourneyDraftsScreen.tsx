import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileTheme } from '@/features/profile/theme';
import { listDrafts } from './draftStorage';
import type { JourneyDraft } from './draft';
import { colors } from '@/theme/colors';

export function JourneyDraftsScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { user } = useAuth();
  const theme = useProfileTheme();
  const [drafts, setDrafts] = useState<JourneyDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => {
    if (!user) return;
    try { setDrafts(listDrafts(user.id)); setError(null); }
    catch { setError('Saved drafts could not be loaded. Please try again.'); }
  }, [user]);
  useFocusEffect(refresh);
  return <SafeAreaView style={[styles.safe, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
    <View style={styles.header}><Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => router.back()} style={styles.action}><Ionicons name="chevron-back" size={25} color={resolvePresentationColor(colors.accent, 'color', 'content')} /></Pressable><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Drafts</Text><View style={styles.action} /></View>
    {error ? <Pressable accessibilityRole="button" onPress={refresh} style={styles.empty}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{error} Tap to retry.</Text></Pressable> : null}
    <FlatList data={drafts} keyExtractor={item => item.requestId} contentContainerStyle={styles.content} renderItem={({ item }) => {
      const cover = item.photos.find(photo => photo.key === item.coverKey) ?? item.photos[0];
      return <Pressable accessibilityRole="button" accessibilityLabel={`Resume ${item.values.title || 'Untitled journey'}`} onPress={() => router.replace({ pathname: '/journey/new', params: { draftId: item.requestId } })} style={[styles.row, { borderColor: resolvePresentationColor(theme.divider, 'borderColor', 'surface') }]}>
        <View style={[styles.image, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>{cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Ionicons name="images-outline" size={24} color={resolvePresentationColor(theme.muted, 'color', 'content')} />}</View>
        <View style={styles.copy}><Text numberOfLines={1} style={presentationTextStyle([styles.name, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{item.values.title || 'Untitled journey'}</Text><Text style={presentationTextStyle([styles.meta, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{item.photos.length} {item.photos.length === 1 ? 'photo' : 'photos'} · Saved on this device</Text></View><Ionicons name="chevron-forward" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} />
      </Pressable>;
    }} ListEmptyComponent={!error ? <View style={styles.empty}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>No saved drafts yet.</Text></View> : null} />
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1 }, header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, action: { width: 44, height: 44, justifyContent: 'center' }, title: { fontSize: 17, fontWeight: '600' }, content: { paddingHorizontal: 20, paddingBottom: 30 }, row: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 14 }, image: { width: 62, height: 74, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, name: { fontSize: 16, fontWeight: '600' }, meta: { fontSize: 12, marginTop: 6 }, empty: { padding: 30, alignItems: 'center' } });
const presentationBaselineStyles = styles;

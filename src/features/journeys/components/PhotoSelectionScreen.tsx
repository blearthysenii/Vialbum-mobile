import { resolvePresentationColor } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Linking, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Album } from 'expo-media-library/legacy';
import type { SelectedPhoto } from '@/features/media/types';
import type { DraftPhoto } from '../draft';
import { photoIdentity } from '../draft';
import { assetPhoto, deviceLibrary } from '../library';
import { useProfileTheme, type ProfileTheme } from '@/features/profile/theme';
import { colors } from '@/theme/colors';

export function PhotoSelectionScreen({ selected, busy, error, onToggle, onSystemPicker, onNext, onClose, onBack }: {
  selected: DraftPhoto[]; busy: boolean; error: string | null;
  onToggle: (photo: SelectedPhoto, single: boolean) => void;
  onSystemPicker: () => void; onNext: () => void; onClose: () => void; onBack?: () => void;
}) {
  const theme = useProfileTheme();
  const styles = themedStyles(theme);
  const library = useRef(deviceLibrary()).current;
  const { width, height } = useWindowDimensions();
  const [assets, setAssets] = useState<SelectedPhoto[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [album, setAlbum] = useState<Album | null>(null);
  const albumRef = useRef<Album | null>(null);
  const [albumOpen, setAlbumOpen] = useState(false);
  const [status, setStatus] = useState<'loading' | 'granted' | 'limited' | 'denied' | 'unavailable'>(library ? 'loading' : 'unavailable');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const cursor = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const loadingRef = useRef(false);
  const mounted = useRef(true);
  const permissionRequest = useRef(0);
  const [active, setActive] = useState<SelectedPhoto | null>(selected[0] ?? null);
  const [multi, setMulti] = useState(true);
  const gridSize = width / 4;
  const previewHeight = Math.min(width, Math.max(170, height * 0.35));

  const load = useCallback(async (reset = false) => {
    if (!library || (!reset && loadingRef.current)) return;
    const version = reset ? ++generation.current : generation.current;
    if (reset) { cursor.current = undefined; setAssets([]); setHasMore(true); }
    loadingRef.current = true; setLoading(true); setLoadError(null);
    try {
      const page = await library.getAssetsAsync({ first: 60, after: reset ? undefined : cursor.current, album: albumRef.current?.id, mediaType: ['photo', 'video'], sortBy: [['creationTime', false]] });
      if (version !== generation.current) return;
      cursor.current = page.endCursor; setHasMore(page.hasNextPage);
      const photos = page.assets.map(assetPhoto);
      setAssets(current => reset ? photos : [...current, ...photos.filter(photo => !current.some(item => item.key === photo.key))]);
      setActive(current => current ?? photos[0] ?? null);
    } catch (caught) { if (version === generation.current) setLoadError(caught instanceof Error ? caught.message : 'Photos could not be loaded.'); }
    finally { if (version === generation.current) { loadingRef.current = false; setLoading(false); } }
  }, [library]);
  const refreshPermission = useCallback(async (ask = false) => {
    if (!library) return;
    const permissionVersion = ++permissionRequest.current;
    setLoadError(null);
    try {
      let permission = await library.getPermissionsAsync(false, ['photo', 'video']);
      if (ask && !permission.granted && permission.canAskAgain) permission = await library.requestPermissionsAsync(false, ['photo', 'video']);
      if (!mounted.current || permissionVersion !== permissionRequest.current) return;
      if (!permission.granted && permission.accessPrivileges !== 'limited') {
        generation.current++; loadingRef.current = false; setLoading(false); setAssets([]); setStatus('denied'); return;
      }
      setStatus(permission.accessPrivileges === 'limited' ? 'limited' : 'granted');
      const found = await library.getAlbumsAsync({ includeSmartAlbums: true });
      if (!mounted.current || permissionVersion !== permissionRequest.current) return;
      setAlbums(found.filter(item => item.assetCount > 0));
      if (albumRef.current && !found.some(item => item.id === albumRef.current!.id)) { albumRef.current = null; setAlbum(null); }
      await load(true);
    } catch { if (!mounted.current || permissionVersion !== permissionRequest.current) return; setLoadError('Your photo library could not be opened. Try again or use the system photo picker.'); setStatus('denied'); }
  }, [library, load]);
  useEffect(() => {
    mounted.current = true;
    const pageRequests = generation;
    const permissions = permissionRequest;
    const alive = mounted;
    let timer: ReturnType<typeof setTimeout> | undefined;
    void refreshPermission(true);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void refreshPermission(); });
    const listener = library?.addListener(() => { clearTimeout(timer); timer = setTimeout(() => void refreshPermission(), 200); });
    return () => { alive.current = false; pageRequests.current++; permissions.current++; clearTimeout(timer); app.remove(); listener?.remove(); };
  }, [library, refreshPermission]);
  const displayed = status === 'unavailable' || status === 'denied' ? selected : assets;
  const preview = active ?? selected[0] ?? assets[0];
  const previewUnavailable = selected.find(photo => photoIdentity(photo) === (preview && photoIdentity(preview)))?.unavailable;
  const notice = status === 'limited' ? 'Showing the photos you allowed.' : status === 'denied' ? 'Allow photo access or choose photos with the system picker.' : status === 'unavailable' ? 'Choose photos from your device. Your selection will appear here.' : null;

  return <SafeAreaView style={styles.safe}>
    <StatusBar style={theme.dark ? 'light' : 'dark'} />
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={onBack ? 'Back to photo editing' : 'Close new journey'} disabled={busy} onPress={onBack ?? onClose} style={styles.headerButton}><Ionicons name={onBack ? 'chevron-back' : 'close'} size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
      <Text style={styles.title}>New journey</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Next, edit selected photos" accessibilityState={{ disabled: busy || !selected.length }} disabled={busy || !selected.length} onPress={onNext} style={styles.headerButton}>{busy ? <ActivityIndicator color={resolvePresentationColor(colors.accent, 'color', 'content')} /> : <Text style={[styles.next, !selected.length && styles.disabled]}>Next</Text>}</Pressable>
    </View>
    <View style={{ height: previewHeight, backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }}>
      {preview && !previewUnavailable ? <Image source={{ uri: preview.uri }} recyclingKey={preview.key} contentFit="contain" style={StyleSheet.absoluteFill} accessibilityLabel="Active photo preview" /> : <View style={styles.center}><Ionicons name="images-outline" size={42} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={styles.notice}>{previewUnavailable ? 'Photo unavailable — replace it in the editor' : 'Select your journey photos'}</Text></View>}
    </View>
    <View style={styles.toolbar}>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose photo album" disabled={!albums.length || busy} onPress={() => setAlbumOpen(true)} style={[styles.albumButton, (!albums.length || busy) && styles.disabled]}><Text numberOfLines={1} style={styles.albumTitle}>{album?.title ?? 'Recents'}</Text><Ionicons name="chevron-down" size={15} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Select multiple photos" accessibilityState={{ selected: multi }} disabled={busy} onPress={() => setMulti(value => !value)} style={[styles.multi, multi && styles.multiSelected, busy && styles.disabled]}><Ionicons name="copy-outline" size={17} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><Text style={styles.controlText}>{multi ? `Selected ${selected.length}` : 'Select multiple'}</Text></Pressable>
    </View>
    {notice ? <View style={styles.noticeRow}><Text style={[styles.notice, styles.flex]}>{notice}</Text>{status === 'limited' ? <Pressable accessibilityRole="button" onPress={() => { void library?.presentPermissionsPickerAsync(['photo', 'video']).then(() => refreshPermission()).catch(() => setLoadError('Open Settings to change photo access.')); }} style={styles.smallButton}><Text style={styles.next}>Manage</Text></Pressable> : status === 'denied' ? <Pressable accessibilityRole="button" onPress={() => void Linking.openSettings()} style={styles.smallButton}><Text style={styles.next}>Settings</Text></Pressable> : null}</View> : null}
    <FlatList data={displayed} numColumns={4} extraData={{ selected, dark: theme.dark }} keyExtractor={photo => photo.key} initialNumToRender={24} maxToRenderPerBatch={20} windowSize={5} removeClippedSubviews
      onEndReached={() => { if (hasMore && !loadError && (status === 'granted' || status === 'limited')) void load(); }} onEndReachedThreshold={0.6}
      renderItem={({ item }) => {
        const index = selected.findIndex(photo => photoIdentity(photo) === photoIdentity(item));
        return <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}${index >= 0 ? `, selected ${index + 1}, tap to deselect` : ', select photo'}`} accessibilityState={{ selected: index >= 0 }} disabled={busy} onPress={() => { setActive(item); onToggle(item, !multi); }} style={{ width: gridSize, height: gridSize, padding: 1 }}>
          <Image source={{ uri: item.uri }} recyclingKey={item.key} contentFit="cover" cachePolicy="memory-disk" style={styles.gridImage} />
          <View style={[styles.selectionBadge, index >= 0 && styles.selectedBadge]}>{index >= 0 ? <Text style={styles.badgeText}>{index + 1}</Text> : null}</View>
        </Pressable>;
      }} ListEmptyComponent={<View style={styles.empty}>{loading || status === 'loading' ? <ActivityIndicator color={resolvePresentationColor(theme.ink, 'color', 'content')} /> : <Text style={styles.notice}>{status === 'granted' || status === 'limited' ? 'No photos in this album.' : 'No photos selected yet.'}</Text>}</View>}
      ListFooterComponent={loading && displayed.length ? <ActivityIndicator style={styles.smallButton} color={resolvePresentationColor(theme.ink, 'color', 'content')} /> : null} />
    {error || loadError ? <View accessibilityLiveRegion="polite" style={styles.error}><Text style={styles.notice}>{error ?? loadError}</Text>{loadError ? <Pressable accessibilityRole="button" onPress={() => void refreshPermission(true)} style={styles.smallButton}><Text style={styles.next}>Try again</Text></Pressable> : null}</View> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={onSystemPicker} style={[styles.systemPicker, busy && styles.disabled]}><Ionicons name="images-outline" size={19} color={resolvePresentationColor(colors.accent, 'color', 'content')} /><Text style={styles.next}>Choose photos and videos</Text></Pressable>
    <Modal visible={albumOpen} transparent animationType="fade" onRequestClose={() => setAlbumOpen(false)}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close albums" style={styles.backdrop} onPress={() => setAlbumOpen(false)} />
      <SafeAreaView style={styles.albumSheet}><View style={styles.header}><Text style={styles.title}>Albums</Text><Pressable accessibilityRole="button" onPress={() => setAlbumOpen(false)} style={styles.smallButton}><Text style={styles.next}>Done</Text></Pressable></View><FlatList data={[{ id: '', title: 'Recents', assetCount: 0 }, ...albums]} keyExtractor={item => item.id} renderItem={({ item }) => <Pressable accessibilityRole="button" style={styles.albumRow} onPress={() => { const choice = item.id ? albums.find(value => value.id === item.id)! : null; albumRef.current = choice; setAlbum(choice); setAlbumOpen(false); void load(true); }}><Text style={styles.albumTitle}>{item.title}</Text>{item.id === (album?.id ?? '') ? <Ionicons name="checkmark" color={resolvePresentationColor(colors.accent, 'color', 'content')} size={20} /> : null}</Pressable>} /></SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const themedStyles = (theme: ProfileTheme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.canvas }, flex: { flex: 1 }, header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 }, headerButton: { minWidth: 56, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, title: { color: theme.ink, fontSize: 17, fontWeight: '600' }, next: { color: colors.accent, fontSize: 16, fontWeight: '600' }, disabled: { opacity: 0.4 }, center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }, toolbar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, gap: 12 }, albumButton: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44 }, albumTitle: { color: theme.ink, fontSize: 16, fontWeight: '500', flexShrink: 1 }, multi: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 18, paddingHorizontal: 12, backgroundColor: theme.placeholder }, multiSelected: { backgroundColor: theme.glassStrong, borderWidth: 1, borderColor: theme.border }, controlText: { color: theme.ink, fontSize: 12, fontWeight: '500' }, gridImage: { flex: 1, backgroundColor: theme.placeholder }, selectionBadge: { position: 'absolute', top: 7, right: 7, width: 23, height: 23, borderRadius: 12, borderWidth: 1.5, borderColor: 'white', backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' }, selectedBadge: { backgroundColor: colors.accent, borderColor: colors.accent }, badgeText: { color: 'white', fontSize: 12, fontWeight: '600' }, notice: { color: theme.muted, fontSize: 12, lineHeight: 18 }, noticeRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12 }, smallButton: { padding: 12, minHeight: 44 }, empty: { padding: 28, alignItems: 'center' }, error: { paddingHorizontal: 16, paddingTop: 10 }, systemPicker: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 }, backdrop: { ...StyleSheet.absoluteFill, backgroundColor: theme.dark ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.3)' }, albumSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '70%', minHeight: 300, backgroundColor: theme.canvas, borderWidth: 1, borderColor: theme.border, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, albumRow: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider, minHeight: 54, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { usePreventRemove, type NavigationAction } from 'expo-router/react-navigation';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LoadingState } from '@/components/ui/Feedback';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { useViewerChrome } from '@/features/media/useViewerChrome';
import { ViewerCaption } from '@/features/media/components/ViewerCaption';
import { getViewerSession, updateViewerSelection } from '@/features/media/viewerSelection';
import { mediaApi } from '@/features/media/api';
import { PhotoDetailsEditor } from '@/features/media/components/PhotoDetailsEditor';
import { PhotoPager } from '@/features/media/components/PhotoPager';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import type { Memory } from '@/features/memories/types';
import { colors } from '@/theme/colors';

function GlassViewerButton({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
}: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
}>) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  return <Animated.View style={[styles.compactActionWrap, animatedStyle]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { pressed.set(withTiming(0.95, { duration: 110 })); }}
      onPressOut={() => { pressed.set(withTiming(1, { duration: 150 })); }}
      style={styles.compactAction}
    >
        <BlurView pointerEvents="none" intensity={28} tint={presentationBlurTint("dark")} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassTint} />
      {children}
    </Pressable>
  </Animated.View>;
}

export default function PhotoViewerScreen() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { id, mediaId, memoryId, viewerSessionId } = useLocalSearchParams<{ id: string; mediaId: string; memoryId?: string; viewerSessionId?: string }>();
  const { fetchOne } = useJourneys();
  const [photos, setPhotos] = useState<JourneyMedia[]>([]);
  const activePhotoId = useRef(mediaId);
  const [photo, setPhoto] = useState<JourneyMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const chrome = useViewerChrome();
  const revealControls = chrome.reveal;
  const dimensions = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: dimensions.width, height: dimensions.height });
  const session = getViewerSession(viewerSessionId);
  const transition = useSharedValue(0);
  const closeRequest = useSharedValue(0);
  const [allowRemove, setAllowRemove] = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);
  const pendingLocation = useRef<string | null>(null);
  const navigation = useNavigation();
  const dismissY = useSharedValue(0);
  const backdropStyle = useAnimatedStyle(() => ({ opacity: transition.get() * (1 - Math.min(1, dismissY.get() / 300)) }));
  const selectPhoto = useCallback((next: JourneyMedia) => {
    activePhotoId.current = next.id;
    updateViewerSelection(viewerSessionId, next.id);
    setPhoto(next);
    revealControls();
  }, [viewerSessionId, revealControls]);
  const requestClose = useCallback(() => {
    if (photo || (loading && session?.photos?.length)) closeRequest.set(value => value + 1);
    else setAllowRemove(true);
  }, [closeRequest, loading, photo, session]);
  usePreventRemove(!allowRemove, ({ data }) => { pendingAction.current = data.action; requestClose(); });
  const closeViewer = useCallback(() => {
    updateViewerSelection(viewerSessionId, activePhotoId.current);
    setAllowRemove(true);
  }, [viewerSessionId]);
  useEffect(() => {
    if (!allowRemove) return;
    if (pendingAction.current) navigation.dispatch(pendingAction.current);
    else router.back();
    if (pendingLocation.current) session?.onLocation?.(pendingLocation.current);
  }, [allowRemove, navigation, session]);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [items, journeyMemories] = await Promise.all([mediaApi.list(id), memoryApi.list(id), fetchOne(id)]);
      setPhotos(items.filter(item => item.type === 'photo' && (!memoryId || item.memory_id === memoryId)));
      setPhoto(items.find((item) => item.id === mediaId) ?? null);
      setMemories(journeyMemories);
    }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [fetchOne, id, mediaId, memoryId]);
  useEffect(() => { void load(); }, [load]);

  const controlsStyle = useAnimatedStyle(() => ({
    opacity: chrome.opacity.get() * transition.get() * (1 - Math.min(1, dismissY.get() / 100)),
    transform: [{ translateY: (1 - chrome.opacity.get()) * 6 }],
  }));

  async function setCover() {
    if (busy || !photo) return;
    setBusy(true);
    try {
      await mediaApi.setCover(id, photo.id);
      await fetchOne(id);
      Alert.alert('Album cover updated', 'This photograph now represents your journey.');
    } catch {
      Alert.alert('Could not update cover', 'Please try again.');
    } finally { setBusy(false); }
  }

  function confirmDelete() {
    Alert.alert('Delete this photo?', 'It will be removed permanently from this album.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => void remove() },
    ]);
  }

  async function remove() {
    if (busy || !photo) return;
    setBusy(true);
    try {
      await mediaApi.remove(id, photo.id);
      await fetchOne(id);
      setAllowRemove(true);
    } catch {
      Alert.alert('Could not delete photo', 'The photograph is still safe. Please try again.');
      setBusy(false);
    }
  }

  function showPhotoActions() {
    chrome.reveal();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options: ['Edit details', 'Set as cover', 'Delete photo', 'Cancel'], cancelButtonIndex: 3, destructiveButtonIndex: 2, userInterfaceStyle: 'dark' }, index => {
        if (index === 0) setEditingDetails(true);
        else if (index === 1) void setCover();
        else if (index === 2) confirmDelete();
      });
    } else Alert.alert('Photo', undefined, [
      { text: 'Edit details', onPress: () => setEditingDetails(true) },
      { text: 'More options', onPress: () => Alert.alert('Photo', undefined, [
        { text: 'Set as cover', onPress: () => void setCover() },
        { text: 'Delete photo', style: 'destructive', onPress: confirmDelete },
        { text: 'Cancel', style: 'cancel' },
      ]) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const previewPhoto = session?.photos?.find(item => item.id === mediaId);
  if (loading && previewPhoto && session?.photos) return <GestureHandlerRootView style={styles.screen}>
    <StatusBar style="light" />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: resolvePresentationColor('#000000', 'backgroundColor', 'content') }, backdropStyle]} />
    <PhotoPager photos={session.photos} photo={previewPhoto} width={dimensions.width} height={dimensions.height} disabled onChange={() => {}} onClose={closeViewer} origin={session.origin} transition={transition} closeRequest={closeRequest} dismissY={dismissY} />
  </GestureHandlerRootView>;
  if (loading) return <View style={styles.loading}><LoadingState label="Opening photograph…" /></View>;
  if (!photo) return <SafeAreaView style={styles.errorScreen}><EmptyState title={loadError ? 'This photograph could not be loaded.' : 'This photograph is no longer available.'} message={loadError ? 'Check your connection and try again.' : 'Return to the journey to choose another photograph.'} actionLabel={loadError ? 'Try Again' : 'Go Back'} onAction={() => loadError ? void load() : router.back()} /></SafeAreaView>;
  return <GestureHandlerRootView style={styles.screen}>
    <StatusBar style="light" />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: resolvePresentationColor('#000000', 'backgroundColor', 'content') }, backdropStyle]} />
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setViewport({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      })}
    >
      {viewport.width > 0 && viewport.height > 0 ? <PhotoPager key={`${id}:${viewport.width}:${viewport.height}`} photos={photos} photo={photo}
        width={viewport.width} height={viewport.height} disabled={busy || editingDetails} onChange={selectPhoto} onTap={chrome.reveal} onInteraction={chrome.interaction} onClose={closeViewer} dismissY={dismissY} origin={session?.origin} transition={transition} closeRequest={closeRequest} /> : null}
    </View>

    <Animated.View pointerEvents={chrome.visible ? 'box-none' : 'none'} accessibilityElementsHidden={!chrome.visible} importantForAccessibility={chrome.visible ? 'auto' : 'no-hide-descendants'} style={[styles.topChrome, controlsStyle]}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        {photos.length > 1 ? <Text style={presentationTextStyle(styles.counter)}>{photos.findIndex(item => item.id === photo.id) + 1} / {photos.length}</Text> : <View />}
        <View style={styles.navigation}>
          <GlassViewerButton accessibilityLabel="Photo actions" disabled={busy} onPress={showPhotoActions}><Ionicons name="ellipsis-horizontal" size={21} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></GlassViewerButton>
          <GlassViewerButton accessibilityLabel="Close photo" onPress={requestClose}><Ionicons name="close" size={22} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} /></GlassViewerButton>
        </View>
      </SafeAreaView>
    </Animated.View>
    <Animated.View pointerEvents={chrome.visible ? 'box-none' : 'none'} accessibilityElementsHidden={!chrome.visible} importantForAccessibility={chrome.visible ? 'auto' : 'no-hide-descendants'} style={[styles.bottomChrome, controlsStyle]}>
      <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 22, paddingBottom: 20 }}>
        <ViewerCaption photo={photo} startDate={session?.startDate} onLocation={session?.onLocation ? () => { pendingLocation.current = photo.id; requestClose(); } : undefined} />
      </SafeAreaView>
    </Animated.View>
    {editingDetails ? <PhotoDetailsEditor journeyId={id} photo={photo} memories={memories} onClose={() => setEditingDetails(false)} onSaved={updated => { setPhoto(updated); setPhotos(items => items.map(item => item.id === updated.id ? updated : item)); }} /> : null}
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, loading: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }, errorScreen: { flex: 1, backgroundColor: colors.canvas },
  navigation: { flexDirection: 'row', alignItems: 'center', gap: 10 }, counter: { color: '#DDDDDD', alignSelf: 'center', fontSize: 13, fontVariant: ['tabular-nums'] },
  topChrome: { position: 'absolute', top: 0, left: 0, right: 0 }, topSafe: { paddingHorizontal: 18, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  bottomChrome: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  glassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.04)' },
  compactActionWrap: { width: 44, height: 44 }, compactAction: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(40,40,40,0.35)' },
});
const presentationBaselineStyles = styles;

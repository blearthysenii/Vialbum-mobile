import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, LoadingState } from '@/components/ui/Feedback';
import { useJourneys } from '@/features/journeys/JourneyProvider';
import { mediaApi } from '@/features/media/api';
import { PhotoDetailsEditor } from '@/features/media/components/PhotoDetailsEditor';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { JourneyMedia } from '@/features/media/types';
import { memoryApi } from '@/features/memories/api';
import type { Memory } from '@/features/memories/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/tokens';

const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.25;
const MAX_SCALE = 4;

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

function GlassViewerButton({
  children,
  onPress,
  disabled = false,
  accessibilityLabel,
  compact = false,
  destructive = false,
}: PropsWithChildren<{
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  compact?: boolean;
  destructive?: boolean;
}>) {
  const pressed = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: pressed.value }] }));

  return <Animated.View style={[compact ? styles.compactActionWrap : styles.actionWrap, animatedStyle]}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { pressed.set(withTiming(0.95, { duration: 110 })); }}
      onPressOut={() => { pressed.set(withTiming(1, { duration: 150 })); }}
      style={[compact ? styles.compactAction : styles.action, destructive && styles.delete]}
    >
      {compact ? <>
        <BlurView pointerEvents="none" intensity={42} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.glassTint} />
      </> : null}
      {children}
    </Pressable>
  </Animated.View>;
}

export default function PhotoViewerScreen() {
  const { id, mediaId } = useLocalSearchParams<{ id: string; mediaId: string }>();
  const { fetchOne } = useJourneys();
  const [photo, setPhoto] = useState<JourneyMedia | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [editingDetails, setEditingDetails] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const controlsProgress = useSharedValue(1);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const [items, journeyMemories] = await Promise.all([mediaApi.list(id), memoryApi.list(id), fetchOne(id)]);
      setPhoto(items.find((item) => item.id === mediaId) ?? null);
      setMemories(journeyMemories);
    }
    catch { setLoadError(true); }
    finally { setLoading(false); }
  }, [fetchOne, id, mediaId]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    controlsProgress.set(withTiming(controlsVisible ? 1 : 0, { duration: 200 }));
  }, [controlsProgress, controlsVisible]);

  const imageFrame = useMemo(() => {
    if (!viewport.width || !viewport.height) return { width: 0, height: 0 };
    const imageWidth = photo?.width || viewport.width;
    const imageHeight = photo?.height || viewport.height;
    const imageRatio = imageWidth / imageHeight;
    const viewportRatio = viewport.width / viewport.height;
    return imageRatio > viewportRatio
      ? { width: viewport.width, height: viewport.width / imageRatio }
      : { width: viewport.height * imageRatio, height: viewport.height };
  }, [photo?.height, photo?.width, viewport.height, viewport.width]);

  const toggleControls = useCallback(() => setControlsVisible((current) => !current), []);

  const zoomGesture = useMemo(() => {
    const bounds = (nextScale: number) => {
      'worklet';
      return {
        x: Math.max(0, (imageFrame.width * nextScale - viewport.width) / 2),
        y: Math.max(0, (imageFrame.height * nextScale - viewport.height) / 2),
      };
    };

    const pinch = Gesture.Pinch()
      .onStart(() => {
        savedScale.set(scale.value);
        savedTranslateX.set(translateX.value);
        savedTranslateY.set(translateY.value);
      })
      .onUpdate((event) => {
        const nextScale = clamp(savedScale.value * event.scale, 0.86, MAX_SCALE + 0.2);
        const ratio = nextScale / savedScale.value;
        const focalX = event.focalX - viewport.width / 2;
        const focalY = event.focalY - viewport.height / 2;
        const nextX = focalX * (1 - ratio) + savedTranslateX.value * ratio;
        const nextY = focalY * (1 - ratio) + savedTranslateY.value * ratio;
        const limit = bounds(nextScale);
        scale.set(nextScale);
        translateX.set(clamp(nextX, -limit.x, limit.x));
        translateY.set(clamp(nextY, -limit.y, limit.y));
      })
      .onEnd(() => {
        const targetScale = clamp(scale.value, MIN_SCALE, MAX_SCALE);
        const reset = targetScale <= MIN_SCALE;
        const limit = bounds(targetScale);
        scale.set(withSpring(targetScale, { damping: 24, stiffness: 260, overshootClamping: true }));
        translateX.set(withSpring(reset ? 0 : clamp(translateX.value, -limit.x, limit.x), { damping: 24, stiffness: 260, overshootClamping: true }));
        translateY.set(withSpring(reset ? 0 : clamp(translateY.value, -limit.y, limit.y), { damping: 24, stiffness: 260, overshootClamping: true }));
        savedScale.set(targetScale);
        savedTranslateX.set(reset ? 0 : clamp(translateX.value, -limit.x, limit.x));
        savedTranslateY.set(reset ? 0 : clamp(translateY.value, -limit.y, limit.y));
      });

    const pan = Gesture.Pan()
      .maxPointers(1)
      .minDistance(2)
      .onStart(() => {
        savedTranslateX.set(translateX.value);
        savedTranslateY.set(translateY.value);
      })
      .onUpdate((event) => {
        if (scale.value <= MIN_SCALE) return;
        const limit = bounds(scale.value);
        translateX.set(clamp(savedTranslateX.value + event.translationX, -limit.x, limit.x));
        translateY.set(clamp(savedTranslateY.value + event.translationY, -limit.y, limit.y));
      })
      .onEnd(() => {
        savedTranslateX.set(translateX.value);
        savedTranslateY.set(translateY.value);
      });

    const doubleTap = Gesture.Tap().numberOfTaps(2).maxDuration(260).onEnd((event, success) => {
      if (!success) return;
      if (scale.value > MIN_SCALE + 0.01) {
        scale.set(withTiming(MIN_SCALE, { duration: 220 }));
        translateX.set(withTiming(0, { duration: 220 }));
        translateY.set(withTiming(0, { duration: 220 }));
        savedScale.set(MIN_SCALE);
        savedTranslateX.set(0);
        savedTranslateY.set(0);
        return;
      }
      const limit = bounds(DOUBLE_TAP_SCALE);
      const nextX = clamp((viewport.width / 2 - event.x) * (DOUBLE_TAP_SCALE - 1), -limit.x, limit.x);
      const nextY = clamp((viewport.height / 2 - event.y) * (DOUBLE_TAP_SCALE - 1), -limit.y, limit.y);
      scale.set(withTiming(DOUBLE_TAP_SCALE, { duration: 220 }));
      translateX.set(withTiming(nextX, { duration: 220 }));
      translateY.set(withTiming(nextY, { duration: 220 }));
      savedScale.set(DOUBLE_TAP_SCALE);
      savedTranslateX.set(nextX);
      savedTranslateY.set(nextY);
    });

    const singleTap = Gesture.Tap().numberOfTaps(1).maxDuration(250).onEnd((_, success) => {
      if (success) runOnJS(toggleControls)();
    });

    return Gesture.Simultaneous(pinch, pan, Gesture.Exclusive(doubleTap, singleTap));
  }, [imageFrame.height, imageFrame.width, savedScale, savedTranslateX, savedTranslateY, scale, toggleControls, translateX, translateY, viewport.height, viewport.width]);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const topControlsStyle = useAnimatedStyle(() => ({
    opacity: controlsProgress.value,
    transform: [{ translateY: (1 - controlsProgress.value) * -8 }],
  }));
  const bottomControlsStyle = useAnimatedStyle(() => ({
    opacity: controlsProgress.value,
    transform: [{ translateY: (1 - controlsProgress.value) * 8 }],
  }));

  async function setCover() {
    if (busy) return;
    setBusy(true);
    try {
      await mediaApi.setCover(id, mediaId);
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
    if (busy) return;
    setBusy(true);
    try {
      await mediaApi.remove(id, mediaId);
      await fetchOne(id);
      router.back();
    } catch {
      Alert.alert('Could not delete photo', 'The photograph is still safe. Please try again.');
      setBusy(false);
    }
  }

  if (loading) return <View style={styles.loading}><LoadingState label="Opening photograph…" /></View>;
  if (!photo) return <SafeAreaView style={styles.errorScreen}><EmptyState title={loadError ? 'This photograph could not be loaded.' : 'This photograph is no longer available.'} message={loadError ? 'Check your connection and try again.' : 'Return to the journey to choose another photograph.'} actionLabel={loadError ? 'Try Again' : 'Go Back'} onAction={() => loadError ? void load() : router.back()} /></SafeAreaView>;
  return <GestureHandlerRootView style={styles.screen}>
    <StatusBar style="light" />
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(event) => setViewport({
        width: event.nativeEvent.layout.width,
        height: event.nativeEvent.layout.height,
      })}
    >
      <GestureDetector gesture={zoomGesture}>
        <Animated.View accessibilityLabel="Journey photograph. Pinch or double tap to zoom." style={[StyleSheet.absoluteFill, styles.photoStage, imageStyle]}>
          <Image source={cachedImageSource(photo.url, `photo-viewer:${photo.id}`)} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" transition={150} />
        </Animated.View>
      </GestureDetector>
    </View>

    <Animated.View pointerEvents={controlsVisible ? 'box-none' : 'none'} style={[styles.topChrome, topControlsStyle]}>
      <SafeAreaView edges={['top']} style={styles.topSafe}>
        <GlassViewerButton compact accessibilityLabel="Go back" onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color="#FFFFFF" />
        </GlassViewerButton>
      </SafeAreaView>
    </Animated.View>

    <Animated.View pointerEvents={controlsVisible ? 'box-none' : 'none'} style={[styles.bottomChrome, bottomControlsStyle]}>
      <SafeAreaView edges={['bottom']} style={styles.bottomSafe}>
        <View style={styles.bottomPanel}>
          <BlurView pointerEvents="none" intensity={48} tint="systemUltraThinMaterialDark" style={StyleSheet.absoluteFill} />
          <View pointerEvents="none" style={styles.panelTint} />
          <View style={styles.actions}>
            <GlassViewerButton accessibilityLabel="Edit photo details" disabled={busy} onPress={() => setEditingDetails(true)}>
              <View style={styles.actionContent}>
                <View style={styles.actionIcon}><Ionicons name="pencil" size={22} color="#FFFFFF" /></View>
                <Text style={styles.actionText}>Edit</Text>
              </View>
            </GlassViewerButton>
            <View pointerEvents="none" style={styles.separator} />
            <GlassViewerButton accessibilityLabel="Set photo as journey cover" disabled={busy} onPress={() => void setCover()}>
              <View style={styles.actionContent}>
                <View style={styles.actionIcon}><Ionicons name="image-outline" size={23} color="#FFFFFF" /></View>
                <Text style={styles.actionText}>Set as Cover</Text>
              </View>
            </GlassViewerButton>
            <View pointerEvents="none" style={styles.separator} />
            <GlassViewerButton accessibilityLabel="Delete photo" disabled={busy} destructive onPress={confirmDelete}>
              <View style={styles.actionContent}>
                <View style={[styles.actionIcon, styles.deleteIcon]}><Ionicons name="trash-outline" size={23} color="#FF453A" /></View>
                <Text style={styles.deleteText}>Delete</Text>
              </View>
            </GlassViewerButton>
          </View>
        </View>
      </SafeAreaView>
    </Animated.View>
    {editingDetails ? <PhotoDetailsEditor journeyId={id} photo={photo} memories={memories} onClose={() => setEditingDetails(false)} onSaved={setPhoto} /> : null}
  </GestureHandlerRootView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' }, loading: { flex: 1, backgroundColor: '#000000', alignItems: 'center', justifyContent: 'center' }, errorScreen: { flex: 1, backgroundColor: colors.canvas },
  photoStage: { backgroundColor: '#000000' },
  topChrome: { position: 'absolute', top: 0, left: 0, right: 0 }, topSafe: { paddingHorizontal: 18, paddingTop: 8 },
  bottomChrome: { position: 'absolute', left: 0, right: 0, bottom: 0 }, bottomSafe: { paddingHorizontal: 32, paddingBottom: 18 },
  bottomPanel: { height: 112, borderRadius: 36, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.11)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)', shadowColor: '#000000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 24, elevation: 5 },
  panelTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.04)' },
  glassTint: { position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.08)' },
  compactActionWrap: { width: 50, height: 50 }, compactAction: { width: 50, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.30)' },
  actions: { flex: 1, flexDirection: 'row', alignItems: 'center' }, actionWrap: { flex: 1, height: '100%' },
  action: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  delete: { backgroundColor: 'transparent' },
  actionContent: { alignItems: 'center', justifyContent: 'center', gap: 7 },
  actionIcon: { width: 50, height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.20)' },
  deleteIcon: { backgroundColor: 'rgba(255,69,58,0.08)', borderColor: 'rgba(255,69,58,0.22)' },
  separator: { width: StyleSheet.hairlineWidth, height: 50, backgroundColor: 'rgba(255,255,255,0.18)' },
  actionText: { ...typography.button, color: '#F7F7F7', fontSize: 13, lineHeight: 16 }, deleteText: { ...typography.button, color: '#FF453A', fontSize: 13, lineHeight: 16 },
});

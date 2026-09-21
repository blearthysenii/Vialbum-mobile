import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { cachedImageSource } from '@/features/media/imageUrl';
import type { PublicPhoto } from '../types';

export function PublicPhotoViewer({ photo, onClose }: { photo: PublicPhoto | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  return <Modal visible={Boolean(photo)} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
    {photo ? <ViewerContent key={`${photo.id}:${width}:${height}`} photo={photo} onClose={onClose} /> : null}
  </Modal>;
}

function ViewerContent({ photo, onClose }: { photo: PublicPhoto; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const zoom = useSharedValue(1);
  const offset = useSharedValue(0);
  const dismissing = useSharedValue(false);
  const dragging = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler(event => { zoom.set(event.zoomScale ?? 1); });
  const nativeScroll = Gesture.Native();
  const pan = Gesture.Pan().maxPointers(1).activeOffsetY([-12, 12]).failOffsetX([-12, 12])
    .simultaneousWithExternalGesture(nativeScroll)
    .onTouchesDown((event, manager) => {
      if (event.numberOfTouches > 1 || zoom.get() > 1.01 || dismissing.get()) manager.fail();
    })
    .onStart(() => { dragging.set(zoom.get() <= 1.01); })
    .onUpdate(event => {
      if (dragging.get() && zoom.get() <= 1.01) offset.set(event.translationY);
    })
    .onEnd((event, success) => {
      if (!success || !dragging.get() || zoom.get() > 1.01) return;
      const distance = Math.abs(event.translationY);
      const vertical = distance > Math.abs(event.translationX) * 1.2;
      const fast = Math.abs(event.velocityY) > 1100 && distance > 24;
      if (vertical && (distance > height * 0.23 || fast)) {
        dismissing.set(true);
        const direction = Math.sign(event.translationY);
        if (reduced) runOnJS(onClose)();
        else offset.set(withTiming(direction * height, { duration: 180 }, finished => { if (finished) runOnJS(onClose)(); }));
      }
    })
    .onFinalize(() => {
      dragging.set(false);
      if (!dismissing.get()) offset.set(reduced ? 0 : withSpring(0, { damping: 24, stiffness: 260, overshootClamping: true }));
    });
  const background = useAnimatedStyle(() => ({ opacity: 1 - Math.min(1, Math.abs(offset.get()) / height) }));
  const image = useAnimatedStyle(() => ({ transform: [
    { translateY: offset.get() },
    { scale: reduced ? 1 : 1 - Math.min(0.15, Math.abs(offset.get()) / height * 0.2) },
  ] }));
  const controls = useAnimatedStyle(() => ({ opacity: 1 - Math.min(0.5, Math.abs(offset.get()) / height) }));
  return <GestureHandlerRootView style={styles.screen}>
    <StatusBar style="light" />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, background]} />
    <GestureDetector gesture={pan}>
      <Animated.View style={[StyleSheet.absoluteFill, image]}>
        <GestureDetector gesture={nativeScroll}>
          <Animated.ScrollView maximumZoomScale={3} minimumZoomScale={1} centerContent bounces={false}
            scrollEventThrottle={16} onScroll={onScroll} contentContainerStyle={{ width, height }}>
            <Image source={cachedImageSource(photo.url, `public-photo:${photo.id}`)} style={{ width, height }} contentFit="contain" cachePolicy="memory-disk" />
          </Animated.ScrollView>
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
    <Animated.View pointerEvents="box-none" style={[styles.controls, controls]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={10} onPress={onClose}
        style={[styles.close, { top: insets.top + 10, right: Math.max(16, insets.right + 10) }]}><Ionicons name="close" size={23} color="#FFFFFF" /></Pressable>
      {photo.caption ? <Text pointerEvents="none" style={[styles.caption, { bottom: insets.bottom + 20, left: insets.left + 20, right: insets.right + 20 }]}>{photo.caption}</Text> : null}
    </Animated.View>
  </GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, backdrop: { backgroundColor: '#000000' }, controls: { ...StyleSheet.absoluteFill, zIndex: 20, elevation: 20 },
  close: { position: 'absolute', zIndex: 21, elevation: 21, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(50,50,50,0.75)' },
  caption: { position: 'absolute', color: '#FFFFFF', fontSize: 15, lineHeight: 22 },
});

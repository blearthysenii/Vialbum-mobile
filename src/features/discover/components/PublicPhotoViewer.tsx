import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useCallback, useEffect, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PhotoPager } from '@/features/media/components/PhotoPager';
import { ViewerCaption } from '@/features/media/components/ViewerCaption';
import { useViewerChrome } from '@/features/media/useViewerChrome';
import type { PhotoOrigin } from '@/features/media/viewerGeometry';
import type { PublicPhoto } from '../types';

type ViewerProps = { photos: PublicPhoto[]; onClose: () => void; onPhotoChange?: (photo: PublicPhoto) => void; origin?: PhotoOrigin; startDate?: string; onLocation?: (photo: PublicPhoto) => void };
export function PublicPhotoViewer({ photo, ...props }: ViewerProps & { photo: PublicPhoto | null }) {
  const { width, height } = useWindowDimensions();
  const close = useRef<() => void>(props.onClose);
  const registerClose = useCallback((handler: () => void) => { close.current = handler; }, []);
  return <Modal visible={Boolean(photo)} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close.current()}>
    {photo ? <GalleryContent key={`${width}:${height}`} initialPhoto={photo} {...props} registerClose={registerClose} /> : null}
  </Modal>;
}

function GalleryContent({ initialPhoto, photos, onClose, onPhotoChange, origin, startDate, onLocation, registerClose }: ViewerProps & { initialPhoto: PublicPhoto; registerClose: (handler: () => void) => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [photo, setPhoto] = useState(initialPhoto);
  const chrome = useViewerChrome();
  const dismissY = useSharedValue(0);
  const transition = useSharedValue(0);
  const closeRequest = useSharedValue(0);
  const pendingLocation = useRef<PublicPhoto | null>(null);
  const requestClose = useCallback(() => closeRequest.set(value => value + 1), [closeRequest]);
  useEffect(() => { registerClose(requestClose); }, [registerClose, requestClose]);
  const selectPhoto = (next: PublicPhoto) => { setPhoto(next); onPhotoChange?.(next); chrome.reveal(); };
  const finishClose = () => { onClose(); if (pendingLocation.current) onLocation?.(pendingLocation.current); };
  const fadeStyle = useAnimatedStyle(() => ({ opacity: transition.get() * (1 - Math.min(1, dismissY.get() / 300)) }));
  const controlsStyle = useAnimatedStyle(() => ({ opacity: chrome.opacity.get() * transition.get() * (1 - Math.min(1, dismissY.get() / 100)), transform: [{ translateY: (1 - chrome.opacity.get()) * 6 }] }));
  const index = Math.max(0, photos.findIndex(item => item.id === photo.id));
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return <GestureHandlerRootView style={styles.screen}>
    <StatusBar style="light" />
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.backdrop, fadeStyle]} />
    <PhotoPager photos={photos} photo={photo} width={width} height={height} onChange={selectPhoto} onClose={finishClose} dismissY={dismissY}
      origin={origin} transition={transition} closeRequest={closeRequest} onTap={chrome.reveal} onInteraction={chrome.interaction} />
    <Animated.View pointerEvents={chrome.visible ? 'box-none' : 'none'} accessibilityElementsHidden={!chrome.visible} importantForAccessibility={chrome.visible ? 'auto' : 'no-hide-descendants'} style={[styles.controls, controlsStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close photo" hitSlop={8} onPress={requestClose}
        style={[styles.close, { top: insets.top + 10, right: Math.max(16, insets.right + 10) }]}>
        <BlurView pointerEvents="none" intensity={28} tint={presentationBlurTint("dark")} style={StyleSheet.absoluteFill} /><Ionicons name="close" size={22} color={resolvePresentationColor("#FFFFFF", 'color', 'content')} />
      </Pressable>
      {photos.length > 1 ? <Text pointerEvents="none" accessibilityLabel={`Photo ${index + 1} of ${photos.length}`} style={presentationTextStyle([styles.counter, { top: insets.top + 24, left: Math.max(22, insets.left + 16) }])}>{index + 1} / {photos.length}</Text> : null}
      <Animated.View style={[styles.caption, { bottom: insets.bottom + 20, left: insets.left + 22, right: insets.right + 22 }]}>
        <ViewerCaption photo={photo} startDate={startDate} onLocation={onLocation ? () => { pendingLocation.current = photo; requestClose(); } : undefined} />
      </Animated.View>
    </Animated.View>
  </GestureHandlerRootView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, backdrop: { backgroundColor: '#000000' }, controls: { ...StyleSheet.absoluteFill, zIndex: 20, elevation: 20 },
  close: { position: 'absolute', width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(40,40,40,0.35)' },
  counter: { position: 'absolute', color: '#DDDDDD', fontSize: 13, fontVariant: ['tabular-nums'] },
  caption: { position: 'absolute' },
});
const presentationBaselineStyles = styles;

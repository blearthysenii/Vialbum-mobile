import * as Haptics from 'expo-haptics';
import { heroGeometry, type PhotoOrigin } from '../viewerGeometry';
import { Image } from 'expo-image';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { cachedImageSource } from '../imageUrl';

type Photo = { id: string; url: string; width: number | null; height: number | null };
const MIN_SCALE = 1;
const DOUBLE_TAP_SCALE = 2.25;
const MAX_SCALE = 4;
function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}
const noop = () => {};
const thresholdHaptic = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); };
type ViewerMotion = { origin?: PhotoOrigin; transition?: SharedValue<number>; closeRequest?: SharedValue<number>; onInteraction?: (active: boolean) => void };

export function PhotoPager<T extends Photo>({ photos, photo, width, height, disabled = false, onChange, onTap = noop, onClose, dismissY, origin, transition, closeRequest, onInteraction }: {
  photos: T[]; photo: T; width: number; height: number; disabled?: boolean;
  onChange: (photo: T) => void; onTap?: () => void; onClose?: () => void; dismissY?: SharedValue<number>;
} & ViewerMotion) {
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    transition?.set(reducedMotion ? withTiming(1, { duration: 120 }) : withSpring(1, { damping: 28, stiffness: 300, overshootClamping: true }));
  }, [transition, reducedMotion]);
  const index = Math.max(0, photos.findIndex(item => item.id === photo.id));
  const position = useSharedValue(-index * width);
  const zoomed = useSharedValue(false);
  const settling = useSharedValue(false);
  const dragStart = useSharedValue(-index * width);
  const current = useRef(index);
  const select = useCallback((next: number) => {
    current.current = next;
    if (photos[next]) onChange(photos[next]);
  }, [photos, onChange]);
  useEffect(() => {
    if (current.current === index) return;
    current.current = index;
    zoomed.set(false);
    settling.set(true);
    position.set(withTiming(-index * width, { duration: 220 }, () => { settling.set(false); }));
  }, [index, width, position, settling, zoomed]);
  const localDismissY = useSharedValue(0);
  const pullY = dismissY ?? localDismissY;
  const drag = Gesture.Pan().enabled(!disabled && photos.length > 1).maxPointers(1)
    .activeOffsetX([-8, 8]).failOffsetY([-16, 16])
    .onTouchesDown((_, manager) => { if (zoomed.get() || settling.get() || pullY.get() > 0 || (transition && transition.get() < 0.999)) manager.fail(); })
    .onStart(() => { dragStart.set(position.get()); })
    .onUpdate(event => {
      if (zoomed.get()) return;
      const next = dragStart.get() + event.translationX;
      const minimum = -(photos.length - 1) * width;
      // All mounted photographs move together, one-to-one with the finger.
      position.set(next > 0 ? next * 0.2 : next < minimum ? minimum + (next - minimum) * 0.2 : next);
    })
    .onEnd(event => {
      const startIndex = Math.round(-dragStart.get() / width);
      const projected = -event.translationX - event.velocityX * 0.15;
      const direction = Math.abs(projected) > width * 0.22 ? Math.sign(projected) : 0;
      const next = clamp(startIndex + direction, 0, photos.length - 1);
      settling.set(true);
      // Commit the destination before the settling animation, so the post and caption
      // are ready even if close is requested during the last part of a swipe.
      runOnJS(select)(next);
      position.set(withTiming(-next * width, { duration: 220 }, () => {
        settling.set(false);
      }));
    })
    .onFinalize((_, success) => {
      if (!success && !settling.get()) position.set(withTiming(-index * width, { duration: 180 }));
    });
  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() }] }));
  return <GestureDetector gesture={drag}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Photographs" accessibilityValue={{ min: 1, max: photos.length, now: index + 1 }}
      accessibilityActions={[{ name: 'increment', label: 'Next photo' }, { name: 'decrement', label: 'Previous photo' }]}
      onAccessibilityAction={event => {
        if (disabled) return;
        const delta = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
        const next = clamp(index + delta, 0, photos.length - 1);
        if (next !== index && photos[next]) onChange(photos[next]);
      }}
      onTouchStart={() => onInteraction?.(true)} onTouchEnd={() => onInteraction?.(false)} onTouchCancel={() => onInteraction?.(false)} style={{ width, height, overflow: 'hidden' }}>
      <Animated.View style={[{ width: photos.length * width, height }, stripStyle]}>
        {photos.slice(Math.max(0, index - 1), index + 2).map(item => {
          const itemIndex = photos.indexOf(item);
          return <View key={item.id} style={{ position: 'absolute', left: itemIndex * width, width, height }}>
            <ZoomablePhoto photo={item} active={item.id === photo.id} viewport={{ width, height }} zoomed={zoomed} settling={settling} dismissY={pullY} disabled={disabled} origin={origin} transition={transition} closeRequest={closeRequest} onTap={onTap} onClose={onClose} />
          </View>;
        })}
      </Animated.View>
    </View>
  </GestureDetector>;
}

function ZoomablePhoto({ photo, active, viewport, zoomed, settling, dismissY, disabled, onTap, onClose, origin, transition, closeRequest }: {
  photo: Photo; active: boolean; viewport: { width: number; height: number }; zoomed: SharedValue<boolean>; settling: SharedValue<boolean>; dismissY: SharedValue<number>; disabled: boolean; onTap: () => void; onClose?: () => void;
} & ViewerMotion) {
  const reducedMotion = useReducedMotion();
  const thresholdCrossed = useSharedValue(false);
  const closing = useSharedValue(false);
  const pullX = useSharedValue(0);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  useEffect(() => {
    if (active) return;
    scale.set(1); savedScale.set(1);
    translateX.set(0); translateY.set(0);
    savedTranslateX.set(0); savedTranslateY.set(0);
  }, [active, scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);
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

  const finishClose = useCallback(() => {
    'worklet';
    if (!onClose || closing.get()) return;
    closing.set(true);
    if (transition) {
      const complete = (finished?: boolean) => { 'worklet'; if (finished) runOnJS(onClose)(); };
      transition.set(reducedMotion ? withTiming(0, { duration: 120 }, complete) : withSpring(0, { damping: 28, stiffness: 300, overshootClamping: true }, complete));
    } else {
      dismissY.set(withSpring(viewport.height + imageFrame.height, { damping: 26, stiffness: 230, overshootClamping: true }, finished => {
        if (finished) runOnJS(onClose)();
      }));
    }
  }, [closing, dismissY, imageFrame.height, onClose, reducedMotion, transition, viewport.height]);
  useAnimatedReaction(() => active && !settling.get() ? closeRequest?.get() ?? 0 : 0, (value, previous) => {
    if (active && value > 0 && value !== previous) finishClose();
  }, [active, finishClose]);

  const zoomGesture = useMemo(() => {
    const bounds = (nextScale: number) => {
      'worklet';
      return {
        x: Math.max(0, (imageFrame.width * nextScale - viewport.width) / 2),
        y: Math.max(0, (imageFrame.height * nextScale - viewport.height) / 2),
      };
    };

    const pinch = Gesture.Pinch().enabled(active && !disabled)
      .onTouchesDown((_, manager) => { if (closing.get() || dismissY.get() > 0 || (transition && transition.get() < 0.999)) manager.fail(); })
      .onStart(() => {
        zoomed.set(true);
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
        zoomed.set(true);
        const limit = bounds(targetScale);
        scale.set(withSpring(targetScale, { damping: 24, stiffness: 260, overshootClamping: true }, finished => { if (finished) zoomed.set(targetScale > 1.01); }));
        translateX.set(withSpring(reset ? 0 : clamp(translateX.value, -limit.x, limit.x), { damping: 24, stiffness: 260, overshootClamping: true }));
        translateY.set(withSpring(reset ? 0 : clamp(translateY.value, -limit.y, limit.y), { damping: 24, stiffness: 260, overshootClamping: true }));
        savedScale.set(targetScale);
        savedTranslateX.set(reset ? 0 : clamp(translateX.value, -limit.x, limit.x));
        savedTranslateY.set(reset ? 0 : clamp(translateY.value, -limit.y, limit.y));
      }).onFinalize(() => { zoomed.set(scale.value > 1.01); });

    const pan = Gesture.Pan().enabled(active && !disabled).maxPointers(1).minDistance(2)
      .onTouchesDown((_, manager) => { if (scale.value <= 1.01 || closing.get()) manager.fail(); })
      .onStart(() => { savedTranslateX.set(translateX.value); savedTranslateY.set(translateY.value); })
      .onUpdate(event => {
        const limit = bounds(scale.value);
        translateX.set(clamp(savedTranslateX.value + event.translationX, -limit.x, limit.x));
        translateY.set(clamp(savedTranslateY.value + event.translationY, -limit.y, limit.y));
      });

    const doubleTap = Gesture.Tap().enabled(active && !disabled).numberOfTaps(2).maxDuration(260).onEnd((event, success) => {
      if (!success || closing.get() || (transition && transition.get() < 0.999)) return;
      if (scale.value > MIN_SCALE + 0.01) {
        zoomed.set(true);
        scale.set(withTiming(MIN_SCALE, { duration: 220 }, finished => { if (finished) zoomed.set(false); }));
        translateX.set(withTiming(0, { duration: 220 }));
        translateY.set(withTiming(0, { duration: 220 }));
        savedScale.set(MIN_SCALE);
        savedTranslateX.set(0);
        savedTranslateY.set(0);
        return;
      }
      zoomed.set(true);
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

    const singleTap = Gesture.Tap().enabled(active && !disabled).numberOfTaps(1).maxDuration(250).onEnd((_, success) => {
      if (success && !closing.get()) runOnJS(onTap)();
    });

    const spring = { damping: 26, stiffness: 230, overshootClamping: true };
    const restore = () => {
      'worklet';
      dismissY.set(withSpring(0, spring));
      pullX.set(withSpring(0, spring));
    };
    const dismiss = Gesture.Pan().maxPointers(1).activeOffsetY(16).failOffsetY(-16).failOffsetX([-8, 8])
      .enabled(active && !disabled && Boolean(onClose))
      .onTouchesDown((_, manager) => {
        if (scale.get() > 1.01 || zoomed.get() || settling.get() || closing.get() || (transition && transition.get() < 0.999)) manager.fail();
      })
      .onStart(() => { thresholdCrossed.set(false); })
      .onUpdate(event => {
        if (!thresholdCrossed.get() && event.translationY > 120) { thresholdCrossed.set(true); runOnJS(thresholdHaptic)(); }
        dismissY.set(Math.max(0, event.translationY));
        pullX.set(event.translationX);
      })
      .onEnd(event => {
        if (onClose && scale.get() <= 1.01 && (event.translationY > 120 || (event.translationY > 0 && event.velocityY > 900))) {
          finishClose();
        } else restore();
      })
      .onFinalize((_, success) => { if (!success && !closing.get()) restore(); });
    // Pinching and dismissal are mutually exclusive; zoom panning and taps retain their own recognition.
    return Gesture.Simultaneous(Gesture.Race(pinch, dismiss), pan, Gesture.Exclusive(doubleTap, singleTap));
  }, [active, disabled, transition, finishClose, thresholdCrossed, closing, dismissY, pullX, zoomed, settling, onClose, imageFrame.height, imageFrame.width, savedScale, savedTranslateX, savedTranslateY, scale, onTap, translateX, translateY, viewport.height, viewport.width]);

  const imageStyle = useAnimatedStyle(() => {
    const progress = transition?.get() ?? 1;
    const geometry = heroGeometry(imageFrame, viewport, reducedMotion ? undefined : origin, progress);
    const pull = active ? dismissY.get() : 0;
    return {
      width: geometry.width, height: geometry.height,
      left: (viewport.width - geometry.width) / 2, top: (viewport.height - geometry.height) / 2,
      borderRadius: geometry.radius + 24 * clamp(pull / 300, 0, 1) * progress,
      opacity: !origin || reducedMotion ? progress : 1,
      transform: [
        { translateX: geometry.x + (active ? pullX.get() : 0) * progress },
        { translateY: geometry.y + pull * progress },
        { scale: 1 - 0.15 * clamp(pull / 300, 0, 1) * progress },
      ],
      // At full size zoom must be allowed outside the fitted photo frame.
      overflow: progress > 0.999 && pull === 0 ? 'visible' as const : 'hidden' as const,
    };
  });
  const bitmapStyle = useAnimatedStyle(() => {
    const progress = transition?.get() ?? 1;
    const geometry = heroGeometry(imageFrame, viewport, reducedMotion ? undefined : origin, progress);
    return {
      width: imageFrame.width, height: imageFrame.height,
      left: (geometry.width - imageFrame.width) / 2, top: (geometry.height - imageFrame.height) / 2,
      transform: [
        { translateX: translateX.get() * progress }, { translateY: translateY.get() * progress },
        { scale: geometry.imageScale * (1 + (scale.get() - 1) * progress) },
      ],
    };
  });

  return <View style={{ width: viewport.width, height: viewport.height, overflow: 'hidden' }}>
    <GestureDetector gesture={zoomGesture}>
      <Animated.View style={StyleSheet.absoluteFill} accessibilityLabel="Photograph. Drag left or right to browse. Pinch or double tap to zoom. Pull down to close.">
        <Animated.View style={[{ position: 'absolute' }, imageStyle]}>
          <Animated.View style={[{ position: 'absolute' }, bitmapStyle]}>
            <Image source={cachedImageSource(photo.url, `public-photo:${photo.id}`)} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  </View>;
}

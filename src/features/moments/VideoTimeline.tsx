import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import type { VideoPlayer, VideoThumbnail } from 'expo-video';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useTabBarController } from '@/features/navigation/TabBarScrollContext';
import type { PlaybackGate } from './playback';
import { playbackFraction, playbackTime, scrubTime } from './timeline';
import { createScrubPreviewQueue, previewLeft } from './scrubPreview';

const PREVIEW_WIDTH = 88;
// Playback and preview updates stay local. No frame requests rerender the feed.
export function VideoTimeline({ scrollGesture, player, gate, paused, bottom, fallbackDuration, onScrubStart }: {
  scrollGesture: NativeGesture; player: VideoPlayer | null; gate: PlaybackGate; paused: boolean;
  onScrubStart?: () => void; bottom: number; fallbackDuration: number | null;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { lockInteraction } = useTabBarController();
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(fallbackDuration ?? 0);
  const [scrubbing, setScrubbing] = useState(false);
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const prominence = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const dragging = useRef(false);
  const selected = useRef(0);
  const trackOrigin = useRef(0);
  const unlock = useRef<(() => void) | null>(null);
  const snapshot = useRef({ player, paused, width, duration });
  snapshot.current = { player, paused, width, duration };
  const scrubStartRef = useRef(onScrubStart); scrubStartRef.current = onScrubStart;
  const frames = useMemo(() => createScrubPreviewQueue(
    async target => {
      if (!player) throw new Error('Video is not loaded');
      const images = await player.generateThumbnailsAsync(target, { maxWidth: 176, maxHeight: 312 });
      if (!images[0]) throw new Error('No frame returned');
      return images[0];
    },
    frame => { setThumbnail(frame); setPreviewFailed(false); },
    error => { setPreviewFailed(true); if (__DEV__) console.warn('Moment scrub preview failed', error instanceof Error ? error.message : 'Unknown error'); },
  ), [player]);
  const finish = useCallback(() => {
    frames.cancel(); setThumbnail(null); setPreviewFailed(false); setScrubbing(false);
    try {
      if (dragging.current) {
        dragging.current = false;
        const current = snapshot.current.player;
        if (current) current.seekBy(selected.current - current.currentTime);
        gate.pause(snapshot.current.paused);
      }
    } finally {
      unlock.current?.(); unlock.current = null;
    }
  }, [frames, gate]);
  useLayoutEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state !== 'active') finish(); });
    return () => { finish(); app.remove(); };
  }, [finish]);
  useEffect(() => {
    if (!player) return;
    const update = (current: number, total = player.duration) => {
      if (dragging.current) return;
      setTime(current); if (total > 0) setDuration(total);
      Animated.timing(progress, { toValue: playbackFraction(current, total), duration: 100, useNativeDriver: false }).start();
    };
    update(player.currentTime);
    const ticks = player.addListener('timeUpdate', event => update(event.currentTime));
    const source = player.addListener('sourceLoad', event => update(player.currentTime, event.duration));
    const end = player.addListener('playToEnd', () => {
      if (!dragging.current) { setTime(player.duration); progress.stopAnimation(); progress.setValue(1); }
    });
    return () => { ticks.remove(); source.remove(); end.remove(); progress.stopAnimation(); };
  }, [player, progress]);
  useEffect(() => {
    const animation = Animated.timing(prominence, { toValue: scrubbing ? 1 : 0, duration: 140, useNativeDriver: false });
    animation.start(); return () => animation.stop();
  }, [scrubbing, prominence]);
  const seek = useCallback((absoluteX: number) => {
    if (!dragging.current) return;
    const { player: current, width: trackWidth, duration: total } = snapshot.current;
    if (!current || total <= 0) return;
    const target = scrubTime(absoluteX - trackOrigin.current, trackWidth, total);
    selected.current = target;
    current.currentTime = target;
    setTime(target); progress.setValue(playbackFraction(target, total));
    // End-of-asset positions cannot produce an image; use the last decodable frame.
    frames.request(Math.min(target, Math.max(0, total - 0.05)));
  }, [frames, progress]);
  const scrubGesture = useMemo(() => Gesture.Pan()
    .blocksExternalGesture(scrollGesture)
    .enabled(Boolean(player && duration > 0)).minDistance(0).maxPointers(1)
    .shouldCancelWhenOutside(false).cancelsTouchesInView(true).runOnJS(true)
    .onBegin(event => {
      if (dragging.current) return;
      scrubStartRef.current?.();
      unlock.current = lockInteraction();
      dragging.current = true; trackOrigin.current = event.absoluteX - event.x;
      progress.stopAnimation(); gate.pause(true); setScrubbing(true);
      void Haptics.selectionAsync().catch(() => undefined);
      seek(event.absoluteX);
    })
    .onUpdate(event => seek(event.absoluteX))
    .onEnd(event => seek(event.absoluteX))
    .onFinalize(() => finish()),
  [scrollGesture, player, duration, lockInteraction, progress, gate, seek, finish]);
  return <View style={[styles.row, { bottom }]}>
    {scrubbing ? <View pointerEvents="none" style={[styles.preview, { left: previewLeft(time, duration, width, PREVIEW_WIDTH) }]}>
      <View style={styles.previewImage}>
        {thumbnail ? <Image source={thumbnail} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
          : previewFailed ? <Text style={presentationTextStyle(styles.previewError)}>Preview unavailable</Text> : <ActivityIndicator color={resolvePresentationColor("white", 'color', 'content')} />}
      </View>
      <Text style={presentationTextStyle(styles.time)}>{playbackTime(time)} / {playbackTime(Math.ceil(duration))}</Text>
    </View> : null}
    <GestureDetector gesture={scrubGesture}>
      <View collapsable={false} onLayout={event => setWidth(event.nativeEvent.layout.width)}
        accessibilityRole="adjustable" accessibilityLabel="Video timeline"
        accessibilityValue={{ min: 0, max: Math.ceil(duration), now: Math.floor(time), text: `${playbackTime(time)} of ${playbackTime(Math.ceil(duration))}` }}
        accessibilityActions={[{ name: 'increment', label: 'Forward five seconds' }, { name: 'decrement', label: 'Back five seconds' }]}
        onAccessibilityAction={event => { if (player) { scrubStartRef.current?.(); const target = Math.max(0, Math.min(duration, player.currentTime + (event.nativeEvent.actionName === 'increment' ? 5 : -5))); player.seekBy(target - player.currentTime); } }}
        style={styles.trackTouch}>
        <Animated.View pointerEvents="none" style={[styles.track, { height: prominence.interpolate({ inputRange: [0, 1], outputRange: [2, 4] }) }]}>
          <Animated.View style={[styles.played, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
        </Animated.View>
      </View>
    </GestureDetector>
  </View>;
}
const styles = StyleSheet.create({
  row: { position: 'absolute', left: 20, right: 20, height: 44 },
  preview: { position: 'absolute', bottom: 28, width: PREVIEW_WIDTH, alignItems: 'center', gap: 7 },
  previewImage: { width: PREVIEW_WIDTH, height: 156, borderRadius: 10, overflow: 'hidden', backgroundColor: '#171719', alignItems: 'center', justifyContent: 'center' },
  previewError: { color: 'white', fontSize: 10, textAlign: 'center', padding: 8 },
  time: { color: 'white', fontSize: 11, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'center' },
  trackTouch: { height: 44, justifyContent: 'flex-end', paddingBottom: 8 },
  track: { backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 3, overflow: 'hidden' },
  played: { height: '100%', backgroundColor: 'white' },
});
const presentationBaselineStyles = styles;

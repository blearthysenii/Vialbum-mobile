import * as Haptics from 'expo-haptics';
import type { VideoPlayer } from 'expo-video';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import type { PlaybackGate } from './playback';
import { createTemporaryPlayback } from './temporaryPlayback';

export function VideoInteraction({ id, player, gate, enabled, paused, sourceKey, onHoldChange, onTap }: {
  id: string; player: VideoPlayer | null; gate: PlaybackGate; enabled: boolean;
  onHoldChange: (holding: boolean) => void; paused: boolean; sourceKey: string; onTap: () => void;
}) {
  const speed = useMemo(() => createTemporaryPlayback(), []);
  const changeRef = useRef(onHoldChange); changeRef.current = onHoldChange;
  const setHolding = (value: boolean) => changeRef.current(value);
  const blocked = useRef(false);
  const consumed = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const stop = () => { speed.reset(); setHolding(false); };
  useLayoutEffect(() => {
    const reset = () => { speed.reset(); setHolding(false); };
    const playing = player?.addListener('playingChange', event => { if (!event.isPlaying) reset(); });
    const status = player?.addListener('statusChange', event => { if (event.status !== 'readyToPlay') reset(); });
    const app = AppState.addEventListener('change', state => { if (state !== 'active') reset(); });
    return () => { speed.reset(); setHolding(false); playing?.remove(); status?.remove(); app.remove(); };
  }, [player, speed, enabled, sourceKey]);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <Pressable disabled={!enabled} accessibilityRole="button" accessibilityLabel={paused ? 'Resume video' : 'Pause video'}
      accessibilityHint="Tap to toggle playback. Hold a playing video for temporary double speed."
      delayLongPress={300} style={StyleSheet.absoluteFill}
      onPressIn={event => {
        consumed.current = false; blocked.current = false;
        origin.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      }}
      onTouchMove={event => {
        const dx = event.nativeEvent.pageX - origin.current.x;
        const dy = event.nativeEvent.pageY - origin.current.y;
        if (Math.hypot(dx, dy) > 10) { blocked.current = true; stop(); }
      }}
      onLongPress={() => {
        consumed.current = true;
        if (!blocked.current && enabled && !paused && player && gate.intendsToPlay(id) && speed.begin(player)) {
          setHolding(true); void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        }
      }}
      onPressOut={stop} onTouchEnd={stop} onTouchCancel={stop}
      onPress={() => { if (!consumed.current && !blocked.current) onTap(); }} />
  </View>;
}
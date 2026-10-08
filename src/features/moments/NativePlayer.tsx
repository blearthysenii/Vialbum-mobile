import { resolvePresentationColor } from '@/theme/presentation';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import type { VideoSurfaceProps } from './VideoSurface';
export function NativePlayer({ id, uri, gate, active, onError, onEnd, loop = true, onInterrupted, onTime, onPlayer, initialTime = 0, replay = 0 }: VideoSurfaceProps) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const endRef = useRef(onEnd); endRef.current = onEnd;
  const errorRef = useRef(onError); errorRef.current = onError;
  const interruptedRef = useRef(onInterrupted); interruptedRef.current = onInterrupted;
  const resumeRef = useRef(initialTime); resumeRef.current = initialTime;
  const timeRef = useRef(onTime); timeRef.current = onTime;
  const playerRef = useRef(onPlayer); playerRef.current = onPlayer;
  const player = useVideoPlayer(null, p => {
    p.muted = true; p.playbackRate = 1; p.loop = true; p.staysActiveInBackground = false;
    p.showNowPlayingNotification = false; p.allowsExternalPlayback = false;
    p.audioMixingMode = 'auto'; p.timeUpdateEventInterval = 0.1;
    p.bufferOptions = { preferredForwardBufferDuration: 4 };
  });
  // eslint-disable-next-line react-hooks/immutability -- Expo Video exposes native playback settings through setters.
  useEffect(() => { player.loop = loop; }, [player, loop]);
  useLayoutEffect(() => { playerRef.current?.(player); return () => playerRef.current?.(null); }, [player]);
  // Layout cleanup runs before Expo releases its shared native player.
  useLayoutEffect(() => gate.register(id, player), [gate, id, player]);
  useLayoutEffect(() => {
    let mounted = true; let replacing = true; setLoading(true); setFailed(false);
    const status = player.addListener('statusChange', event => {
      if (!mounted) return;
      setLoading(event.status === 'loading' || event.status === 'idle');
      if (event.status === 'readyToPlay' && !replacing) gate.refresh();
      if (event.status === 'error') { setFailed(true); errorRef.current?.(); }
    });
    let wasPlaying = false;
    let interruptionTimer: ReturnType<typeof setTimeout> | undefined;
    const playing = player.addListener('playingChange', event => {
      if (interruptionTimer) clearTimeout(interruptionTimer);
      if (wasPlaying && !event.isPlaying && !replacing && gate.intendsToPlay(id)) {
        // Waiting for a buffer/seek is not an audio interruption.
        interruptionTimer = setTimeout(() => {
          if (mounted && player.status === 'readyToPlay' && !player.playing && gate.intendsToPlay(id)) interruptedRef.current?.();
        }, 250);
      }
      wasPlaying = event.isPlaying;
    });
    const end = player.addListener('playToEnd', () => { if (mounted) endRef.current?.(); });
    const time = player.addListener('timeUpdate', event => timeRef.current?.(event.currentTime));
    void player.replaceAsync({ uri, useCaching: false }).then(() => { replacing = false; if (mounted) { if (resumeRef.current > 0) player.seekBy(Math.min(resumeRef.current, Math.max(0, player.duration-0.1))); gate.refresh(); } }).catch(() => { if (mounted) { setLoading(false); setFailed(true); errorRef.current?.(); } });
    return () => { mounted = false; if (interruptionTimer) clearTimeout(interruptionTimer); player.playbackRate = 1; player.pause(); status.remove(); time.remove(); playing.remove(); end.remove(); };
  }, [player, uri, gate, id]);
  useEffect(() => { if (active && failed) errorRef.current?.(); }, [active, failed]);
  const lastReplay = useRef(replay);
  useEffect(() => {
    if (lastReplay.current === replay) return;
    lastReplay.current = replay; player.replay(); gate.refresh();
  }, [player, replay, gate]);
  return <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {!failed ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} allowsPictureInPicture={false} /> : null}
    {loading && active ? <ActivityIndicator color={resolvePresentationColor("white", 'color', 'content')} style={StyleSheet.absoluteFill} /> : null}
  </View>;
}

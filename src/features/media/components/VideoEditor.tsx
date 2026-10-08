import { usePresentationStyles, resolvePresentationColor, presentationBlurTint, presentationTextStyle } from '@/theme/presentation';
/* eslint-disable react-hooks/immutability -- Expo Video exposes an imperative native player; its documented setters control playback. */
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useVideoPlayer, VideoView, type VideoThumbnail } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, type NativeGesture } from 'react-native-gesture-handler';
import { useFocusEffect } from 'expo-router';
import type { ProfileTheme } from '@/features/profile/theme';
import { initialVideoEdit, moveTrim, type VideoEdit } from '../videoEdit';
import { playbackTime } from '@/features/moments/timeline';

export function VideoEditor({ uri, duration: suppliedDuration, edit, onChange, theme, muted = false, disabled = false, scrollGesture, creationStyle = false }: {
  uri: string; duration?: number; edit?: VideoEdit; onChange: (edit: VideoEdit) => void;
  creationStyle?: boolean; scrollGesture?: NativeGesture; theme: ProfileTheme; muted?: boolean; disabled?: boolean;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { width: screenWidth } = useWindowDimensions();
  const [playing, setPlaying] = useState(false);
  const [coverFrame, setCoverFrame] = useState<VideoThumbnail | null>(null);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const [duration, setDuration] = useState(suppliedDuration ?? 0);
  const [frames, setFrames] = useState<VideoThumbnail[]>([]);
  const [cover, setCover] = useState(false);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<VideoEdit>();
  const current = pendingEdit ?? edit ?? initialVideoEdit(duration);
  const state = useRef({ edit: current, duration, width, cover, onChange, focused, disabled });
  state.current = { edit: current, duration, width, cover, onChange, focused, disabled };
  const draggingRef = useRef(false);
  const lastSeek = useRef(0);
  const trackLeft = useRef(0);
  const player = useVideoPlayer(uri, value => { value.muted = muted; value.timeUpdateEventInterval = 0.1; });
  useEffect(() => {
    if (!creationStyle) return;
    const listener = player.addListener('playingChange', event => setPlaying(event.isPlaying));
    return () => listener.remove();
  }, [player, creationStyle]);
  useEffect(() => {
    if (!creationStyle || duration <= 0) return;
    let live = true;
    void player.generateThumbnailsAsync((edit?.coverTime ?? 0), { maxWidth: 88, maxHeight: 132 }).then(images => { if (live) setCoverFrame(images[0] ?? null); }).catch(() => undefined);
    return () => { live = false; };
  }, [creationStyle, duration, player, edit?.coverTime, frames.length]);
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    let live = true;
    const setup = (total: number) => {
      if (!live || total <= 0) return;
      setDuration(total);
      if (!state.current.edit.trimEnd) state.current.onChange(initialVideoEdit(total));
      void player.generateThumbnailsAsync(Array.from({ length: 8 }, (_, i) => Math.min(total - 0.05, i * total / 8)), { maxWidth: 96, maxHeight: 160 }).then(images => { if (live) setFrames(images); }).catch(() => { if (live) setError('Video frames could not be loaded.'); });
    };
    if (player.duration > 0) setup(player.duration);
    const source = player.addListener('sourceLoad', event => setup(event.duration));
    const failed = player.addListener('statusChange', event => { if (live && event.status === 'error') setError('This video could not be opened. Choose it again.'); });
    const ticks = player.addListener('timeUpdate', event => {
      const range = state.current.edit;
      if (!draggingRef.current && !state.current.cover && range.trimEnd > 0 && (event.currentTime >= range.trimEnd || event.currentTime < range.trimStart)) player.currentTime = range.trimStart;
    });
    return () => { live = false; source.remove(); failed.remove(); ticks.remove(); };
  }, [player]);
  useEffect(() => {
    if (focused && !disabled && !cover && !dragging && AppState.currentState === 'active') player.play(); else player.pause();
    const app = AppState.addEventListener('change', value => { if (value !== 'active') player.pause(); else if (state.current.focused && !state.current.disabled && !state.current.cover && !draggingRef.current) player.play(); });
    return () => app.remove();
  }, [focused, disabled, cover, dragging, player]);
  const seek = useCallback((time: number, final = false) => {
    if (final || Date.now() - lastSeek.current >= 65) { player.currentTime = time; lastSeek.current = Date.now(); }
  }, [player]);
  const canScrub = duration > 0;
  const gestures = useMemo(() => {
  const gesture = (edge: 'start' | 'end' | 'cover') => Gesture.Pan().enabled(!disabled && canScrub).minDistance(0).shouldCancelWhenOutside(false).runOnJS(true)
    .onBegin(event => {
      const data = state.current;
      const offset = edge === 'cover' ? -22 : (edge === 'start' ? data.edit.trimStart : data.edit.trimEnd) / data.duration * data.width - 22;
      trackLeft.current = event.absoluteX - event.x - offset;
      draggingRef.current = true; setDragging(true); player.pause(); void Haptics.selectionAsync().catch(() => undefined); })
    .onUpdate(event => {
      const data = state.current;
      const value = Math.max(0, Math.min(data.duration, (event.absoluteX - trackLeft.current) / Math.max(1, data.width) * data.duration));
      const next = edge === 'cover' ? { ...data.edit, coverTime: Math.max(data.edit.trimStart, Math.min(data.edit.trimEnd - 0.05, value)) } : moveTrim(data.edit, edge, value, data.duration);
      state.current.edit = next; setPendingEdit(next); seek(edge === 'cover' ? next.coverTime : edge === 'start' ? next.trimStart : next.trimEnd - 0.05);
    })
    .onFinalize(() => { state.current.onChange(state.current.edit); setPendingEdit(undefined); draggingRef.current = false; setDragging(false); seek(state.current.cover ? state.current.edit.coverTime : state.current.edit.trimStart, true); });
    const result = { start: gesture('start'), end: gesture('end'), cover: gesture('cover') };
    if (scrollGesture) Object.values(result).forEach(value => value.blocksExternalGesture(scrollGesture));
    return result;
  }, [disabled, canScrub, player, seek, scrollGesture]);
  const fraction = (time: number) => duration > 0 ? time / duration * width : 0;
  return <GestureHandlerRootView style={styles.editor}>
    <View style={[styles.preview, creationStyle ? { height: Math.min(430, Math.max(280, (screenWidth - 40) * 1.08)), borderRadius: 24 } : null]}><VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" allowsVideoFrameAnalysis={false} />
      <Pressable accessibilityLabel={(creationStyle ? playing : player.playing) ? 'Pause trim preview' : 'Play trim preview'} onPress={() => player.playing ? player.pause() : player.play()} style={creationStyle ? styles.creationPlay : styles.play}>{creationStyle ? <BlurView intensity={35} tint={presentationBlurTint("dark")} style={StyleSheet.absoluteFill} /> : null}<Ionicons name={creationStyle && playing ? 'pause' : 'play-outline'} color={resolvePresentationColor("white", 'color', 'content')} size={23} /></Pressable>
      {creationStyle ? <View pointerEvents="none" style={styles.duration}><Text style={presentationTextStyle(styles.durationText)}>{playbackTime(current.trimEnd - current.trimStart)}</Text></View> : null}
    </View>
    {error ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.danger, 'color', 'content') })}>{error}</Text> : null}
    <View onLayout={event => setWidth(Math.max(0, event.nativeEvent.layout.width - 44))} style={styles.timeline}>
      <View style={styles.frames}>{frames.map((image, index) => <Image key={index} source={image} contentFit="cover" style={styles.frame} />)}</View>
      <View pointerEvents="none" style={[styles.dim, { left: 22, width: fraction(current.trimStart) }]} />
      <View pointerEvents="none" style={[styles.dim, { left: 22 + fraction(current.trimEnd), right: 22 }]} />
      {cover ? <GestureDetector gesture={gestures.cover}><View collapsable={false} style={StyleSheet.absoluteFill}><View pointerEvents="none" style={[styles.coverMarker, { left: 22 + fraction(current.coverTime) }]} /></View></GestureDetector> : <>
        <View pointerEvents="none" style={[styles.selection, { left: 22 + fraction(current.trimStart), width: Math.max(1, fraction(current.trimEnd - current.trimStart)) }]} />
        {(['start', 'end'] as const).map(edge => <GestureDetector key={edge} gesture={gestures[edge]}><View collapsable={false} accessibilityRole="adjustable" accessibilityLabel={`${edge} of video selection`} accessibilityValue={{ text: playbackTime(edge === 'start' ? current.trimStart : current.trimEnd) }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => onChange(moveTrim(current, edge, (edge === 'start' ? current.trimStart : current.trimEnd) + (event.nativeEvent.actionName === 'increment' ? 1 : -1), duration))}
          style={[styles.handleTouch, { left: fraction(edge === 'start' ? current.trimStart : current.trimEnd) }]}><View style={styles.handle}><View style={styles.grip} /></View></View></GestureDetector>)}
      </>}
    </View>
    {creationStyle && !cover ? <View style={styles.timeRow}><Text style={presentationTextStyle([styles.time, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{playbackTime(current.trimStart)}</Text><Text style={presentationTextStyle([styles.time, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{(current.trimEnd - current.trimStart).toFixed(1)} sec</Text><Text style={presentationTextStyle([styles.time, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{playbackTime(current.trimEnd)}</Text></View> : <Text style={presentationTextStyle([styles.time, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>{cover ? `Cover · ${playbackTime(current.coverTime)}.${Math.floor((current.coverTime % 1) * 10)}` : `${playbackTime(current.trimStart)}.${Math.floor((current.trimStart % 1) * 10)} — ${playbackTime(current.trimEnd)}.${Math.floor((current.trimEnd % 1) * 10)} · ${(current.trimEnd - current.trimStart).toFixed(1)} sec`}</Text>}
    {creationStyle ? <View style={[styles.coverRow, { backgroundColor: resolvePresentationColor(theme.dark ? 'rgba(255,255,255,0.065)' : '#F6F5F2', 'backgroundColor', 'surface') }]}><View style={styles.coverThumb}>{coverFrame || frames[0] ? <Image source={coverFrame ?? frames[0]} contentFit="cover" style={StyleSheet.absoluteFill} /> : <Ionicons name="image-outline" size={20} color={resolvePresentationColor(theme.muted, 'color', 'content')} />}</View><View style={{ flex: 1, gap: 4 }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 14, fontWeight: '500' })}>Cover frame</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 11 })}>Choose a frame for your Moment</Text></View><Pressable disabled={disabled} accessibilityLabel={cover ? 'Finish choosing cover frame' : 'Change cover frame'} onPress={() => { setCover(value => !value); seek(current.coverTime, true); void Haptics.selectionAsync().catch(() => undefined); }} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 13 })}>{cover ? 'Done' : 'Change'}</Text></Pressable></View> : <View style={styles.actions}><Pressable disabled={disabled} onPress={() => { setCover(value => !value); seek(current.coverTime, true); }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>{cover ? 'Done choosing cover' : 'Change cover'}</Text></Pressable><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 12 })}>Up to 60 seconds</Text></View>}
  </GestureHandlerRootView>;
}
const styles = StyleSheet.create({ creationPlay: { position: 'absolute', top: '50%', left: '50%', marginLeft: -26, marginTop: -26, width: 52, height: 52, borderRadius: 26, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.12)' }, duration: { position: 'absolute', bottom: 12, right: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)' }, durationText: { color: 'white', fontSize: 11, fontVariant: ['tabular-nums'] }, timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22 }, coverRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18 }, coverThumb: { width: 40, height: 52, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#202022' }, editor: { gap: 14 }, preview: { height: 320, borderRadius: 18, overflow: 'hidden', backgroundColor: '#090909' }, play: { position: 'absolute', right: 12, bottom: 12, padding: 12, borderRadius: 24, backgroundColor: 'rgba(0,0,0,0.25)' }, timeline: { height: 64, paddingHorizontal: 22, paddingVertical: 4 }, frames: { flexDirection: 'row', height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: '#333' }, frame: { flex: 1, height: 56 }, dim: { position: 'absolute', top: 4, bottom: 4, backgroundColor: 'rgba(0,0,0,0.55)' }, selection: { position: 'absolute', top: 4, bottom: 4, borderTopWidth: 2, borderBottomWidth: 2, borderColor: 'white' }, handleTouch: { position: 'absolute', width: 44, height: 64, top: 0, alignItems: 'center', justifyContent: 'center' }, handle: { width: 14, height: 60, backgroundColor: 'white', borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, grip: { height: 20, width: 2, backgroundColor: '#444', borderRadius: 1 }, coverMarker: { position: 'absolute', top: 4, width: 3, height: 56, backgroundColor: 'white' }, time: { textAlign: 'center', fontSize: 13, fontVariant: ['tabular-nums'] }, actions: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 32 } });
const presentationBaselineStyles = styles;

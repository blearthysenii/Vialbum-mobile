import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
/* eslint-disable react-hooks/immutability -- Expo Video player setters are its native playback API. */
import { JourneyCompletion } from './JourneyCompletion';
import { FlightSpeedIndicator } from './FlightSpeedIndicator';
import type { NativeGesture } from 'react-native-gesture-handler';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { VideoPlayer } from 'expo-video';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Moment } from './types';
import type { PlaybackGate } from './playback';
import { MomentOptions, type MomentOption } from './MomentOptions';
import { VideoSurface } from './VideoSurface';
import { VideoTimeline } from './VideoTimeline';
import { useTabBarController } from '@/features/navigation/TabBarScrollContext';
import { PlaybackControls } from './PlaybackControls';
import { VideoInteraction } from './VideoInteraction';
export function MomentFrame({ scrollGesture, item, height, active, preload, visible, validating, failed, retryVersion,
  positions, gate, paused, muted, toggleMute, replay, togglePlayback, interrupted, onError, retry, bottom, options, openJourney }: {
  scrollGesture: NativeGesture; item: Moment; height: number; active: boolean; preload: boolean; visible: boolean; validating: boolean;
  failed: boolean; retryVersion: number; positions: Map<string, number>; gate: PlaybackGate;
  paused: boolean; muted: boolean; toggleMute: () => void; replay: number; togglePlayback: () => void; interrupted: () => void;
  onError: () => void; retry: () => void; bottom: number; options: MomentOption[]; openJourney: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { interactionLocked } = useTabBarController();
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [completed, setCompleted] = useState(false);
  const [dotsBottom, setDotsBottom] = useState<number | null>(null);
  const [holding, setHolding] = useState(false);
  const completedRef = useRef(false);
  const ui = useRef(new Animated.Value(1)).current;
  const finalJourney = Boolean(item.journey_context && item.journey_context.final_moment_id === item.id);
  const clearCompletion = () => { if (completedRef.current) gate.pause(paused); completedRef.current = false; setCompleted(false); };
  useEffect(() => {
    if (!active || !visible || validating || failed) { if (completedRef.current) { gate.pause(paused); positions.set(item.id, 0); } completedRef.current = false; setCompleted(false); setHolding(false); }
  }, [active, visible, validating, failed, item.id, replay, gate, paused, positions]);
  useEffect(() => {
    completedRef.current = false; setCompleted(false);
  }, [replay]);
  useEffect(() => {
    const animation = Animated.timing(ui, { toValue: completed ? 0 : 1, delay: completed ? 200 : 0, duration: 300, useNativeDriver: true });
    animation.start(); return () => animation.stop();
  }, [completed, ui]);
  const finishJourney = () => {
    if (!active || !visible || !finalJourney || !player || completedRef.current || interactionLocked) return;
    player.playbackRate = 1; gate.pause(true); player.pause(); setHolding(false);
    completedRef.current = true; setCompleted(true);
  };
  const resume = () => {
    if (completedRef.current) { clearCompletion(); if (player) { player.playbackRate = 1; player.currentTime = 0; } if (paused) togglePlayback(); else { gate.pause(false); gate.refresh(); } }
    else togglePlayback();
  };
  const title = [item.place.locality || item.place.region, item.place.country].filter(Boolean).join(', ');
  const openPlace = () => router.push({ pathname: '/moment/place/[id]', params: { id: item.place.id } });
  return <View style={[styles.frame, { height }]}>
    <Image source={item.cover_url} style={StyleSheet.absoluteFill} contentFit="cover" />
    {visible && !validating && item.video_url && (active || preload) ? <VideoSurface
      key={`${item.id}:${retryVersion}`} id={item.id} uri={item.video_url} gate={gate}
      initialTime={positions.get(item.id) ?? 0} onTime={time => positions.set(item.id, time)}
      onPlayer={setPlayer} loop={!finalJourney} onEnd={finishJourney} active={active} replay={active ? replay : 0} onError={onError} onInterrupted={interrupted} /> : null}
    {item.video_url ? <VideoInteraction id={item.id} player={player} gate={gate} paused={paused || completed}
      onHoldChange={setHolding} enabled={active && visible && !validating && !failed && !interactionLocked} sourceKey={item.video_url} onTap={resume} /> : null}
    <LinearGradient pointerEvents="none" colors={resolvePresentationColor(['rgba(0,0,0,0.48)', 'transparent'], 'colors', 'content')} style={styles.topGradient} />
    <LinearGradient pointerEvents="none" colors={resolvePresentationColor(['transparent', 'rgba(0,0,0,0.38)', 'rgba(0,0,0,0.78)'], 'colors', 'content')} locations={[0, 0.5, 1]} style={styles.bottomGradient} />
    {active && visible && !validating && item.video_url && !failed && !interactionLocked && !completed ? <PlaybackControls
      paused={paused} muted={muted} silent={item.audio_muted} onPlay={togglePlayback} onMute={toggleMute} /> : null}
    <Animated.View pointerEvents={completed || interactionLocked ? 'none' : 'auto'} style={[styles.information, { opacity: ui, bottom: bottom + (item.video_url ? 58 : 20) }]}>
      <View style={[styles.metadata, item.video_url ? styles.loweredMetadata : null]}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.creator.username}'s profile`}
          onPress={() => router.push({ pathname: '/public-profile/[id]', params: { id: item.creator.id } })} style={styles.creator}>
          {item.creator.avatar_url ? <Image source={item.creator.avatar_url} style={styles.avatar} contentFit="cover" />
            : <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={16} color={resolvePresentationColor("white", 'color', 'content')} /></View>}
          <Text numberOfLines={1} style={presentationTextStyle(styles.username)}>{item.creator.username}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={item.journey_id ? `Open journey: ${item.journey_title}` : `Explore ${title}`}
          onPress={item.journey_id ? openJourney : openPlace}>
          <Text numberOfLines={2} style={presentationTextStyle(styles.title)}>{title}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${item.place.name}`} onPress={openPlace} style={styles.place}>
          <Ionicons name="location-outline" size={16} color={resolvePresentationColor("rgba(255,255,255,0.82)", 'color', 'content')} />
          <Text numberOfLines={1} style={presentationTextStyle(styles.placeName)}>{item.place.name}</Text>
        </Pressable>
        {active && failed ? <Pressable accessibilityRole="button" onPress={retry}><Text style={presentationTextStyle(styles.failure)}>Video unavailable · Tap to retry</Text></Pressable> : null}
      </View>
      {active ? <View style={{ width: 44, height: 44 }}><MomentOptions onAnchorLayout={setDotsBottom} actions={options} onOpen={() => gate.pause(true)} onClose={() => gate.pause(paused)} /><FlightSpeedIndicator top={dotsBottom === null ? 0 : dotsBottom + 12} visible={dotsBottom !== null && holding && !completed} /></View> : null}
    </Animated.View>
    {active && visible && !validating && item.video_url ? <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { opacity: ui }]}><VideoTimeline scrollGesture={scrollGesture} player={player} gate={gate} paused={paused}
      bottom={bottom} fallbackDuration={item.duration} onScrubStart={clearCompletion} /></Animated.View> : null}
    {active && visible && item.journey_context ? <JourneyCompletion visible={completed} context={item.journey_context} onOpen={openJourney} /> : null}
    {validating ? <View style={styles.validating}><ActivityIndicator color={resolvePresentationColor("white", 'color', 'content')} /></View> : null}
  </View>;
}
const styles = StyleSheet.create({
  frame: { backgroundColor: '#080808' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: '24%' },
  bottomGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '48%' },
  information: { position: 'absolute', left: 24, right: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  metadata: { flex: 1, gap: 10 },
  // Keep the options button fixed; this group remains anchored to the safe-area-aware timeline.
  loweredMetadata: { transform: [{ translateY: 24 }] },
  creator: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  username: { flexShrink: 1, color: 'white', fontSize: 14, fontWeight: '500' },
  title: { color: 'white', fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -0.8 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  placeName: { flexShrink: 1, color: 'rgba(255,255,255,0.82)', fontSize: 14 },
  failure: { color: 'white', fontSize: 13 },
  validating: { ...StyleSheet.absoluteFill, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
});
const presentationBaselineStyles = styles;

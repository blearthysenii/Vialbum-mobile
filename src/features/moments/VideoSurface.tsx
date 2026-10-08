import { usePresentationStyles, presentationTextStyle } from '@/theme/presentation';
import { requireOptionalNativeModule } from 'expo';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';
import type { VideoPlayer } from 'expo-video';
import type { PlaybackGate } from './playback';
export type VideoSurfaceProps = { id: string; uri: string; gate: PlaybackGate; active: boolean; onEnd?: () => void; loop?: boolean; onError?: () => void; onInterrupted?: () => void; onTime?: (time: number) => void; onPlayer?: (player: VideoPlayer | null) => void; initialTime?: number; replay?: number };
// Existing development clients continue to open every other Vialbum screen.
const available = Platform.OS === 'web' || Boolean(requireOptionalNativeModule('ExpoVideo'));
// Loading must stay conditional until existing development clients are rebuilt.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const NativePlayer = available ? require('./NativePlayer').NativePlayer as ComponentType<VideoSurfaceProps> : null;
export function VideoSurface(props: VideoSurfaceProps) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return NativePlayer ? <NativePlayer {...props} /> : <View style={styles.missing}><Text style={presentationTextStyle(styles.text)}>Video playback requires the updated Vialbum build.</Text></View>;
}
const styles = StyleSheet.create({ missing: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 35 }, text: { color: '#FFFFFF', textAlign: 'center', lineHeight: 22 } });
const presentationBaselineStyles = styles;

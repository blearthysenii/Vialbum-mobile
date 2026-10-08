import { resolvePresentationColor } from '@/theme/presentation';
import { Image } from 'expo-image';
import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// Uses the same Expo native frame generator as the video editor; no extra stored cover.
export function VideoCover({ uri, time }: { uri: string; time: number }) {
  const [frame, setFrame] = useState<VideoThumbnail | null>(null);
  const player = useVideoPlayer(uri, value => { value.muted = true; value.staysActiveInBackground = false; });
  useEffect(() => {
    let live = true;
    const generate = () => { void player.generateThumbnailsAsync(Math.min(time, Math.max(0, player.duration - 0.05)), { maxWidth: 176, maxHeight: 312 }).then(images => { if (live) setFrame(images[0] ?? null); }).catch(() => { if (live) setFrame(null); }); };
    if (player.duration > 0) generate();
    const source = player.addListener('sourceLoad', generate);
    return () => { live = false; source.remove(); };
  }, [player, time]);
  return frame ? <Image source={frame} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}><ActivityIndicator color={resolvePresentationColor("white", 'color', 'content')} /></View>;
}

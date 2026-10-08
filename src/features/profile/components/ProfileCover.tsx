import { usePresentationStyles, resolvePresentationColor } from '@/theme/presentation';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StableCachedImage } from '@/features/media/components/StableCachedImage';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useProfileTheme } from '@/features/profile/theme';
import { resolveApiImageUrl } from '@/features/media/imageUrl';

export const ProfileCover = memo(function ProfileCover({ source, canvas, dark, reduceMotion, onSourceError }: { onSourceError?: () => void; source: string | null; canvas: string; dark: boolean; reduceMotion: boolean }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useProfileTheme();
  const uri = useMemo(() => resolveApiImageUrl(source, 'profile.cover'), [source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(uri && failedUrl !== uri);
  const imageProgress = useSharedValue(0);
  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageProgress.value,
    transform: [{ scale: reduceMotion ? 1 : 1.015 - imageProgress.value * 0.015 }],
  }));

  useEffect(() => { setFailedUrl(null); }, [uri]);
  useEffect(() => { if (!uri) imageProgress.set(0); }, [uri, imageProgress]);
  const loaded = useCallback(() => {
    if (imageProgress.value < 1) imageProgress.set(withTiming(1, { duration: reduceMotion ? 120 : 350, easing: Easing.out(Easing.cubic) }));
  }, [imageProgress, reduceMotion]);

  return (
    <View style={styles.cover}>
      <LinearGradient colors={resolvePresentationColor(theme.heroColors, 'colors', 'content')} style={StyleSheet.absoluteFill} />
      {showImage ? (
        <Animated.View style={[styles.coverImage, imageStyle]}>
          <StableCachedImage
            uri={uri}
            namespace={`profile-cover:${uri?.split('?')[0]}`}
            contentFit="cover"
            style={StyleSheet.absoluteFill}
            onLoad={loaded}
            onSourceError={onSourceError}
            onError={() => {
              setFailedUrl(uri);
              if (__DEV__) console.warn('[Profile cover] onError', { hasSource: Boolean(uri), failed: true });
            }}
          />
        </Animated.View>
      ) : null}

      <LinearGradient
        pointerEvents="none"
        colors={resolvePresentationColor(['rgba(0,0,0,0.48)', 'rgba(0,0,0,0.16)', 'rgba(0,0,0,0)'], 'colors', 'content')}
        locations={[0, 0.35, 0.7]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={resolvePresentationColor([`${canvas}00`, `${canvas}00`, `${canvas}38`, `${canvas}99`, `${canvas}EB`, canvas], 'colors', 'content')}
        locations={[0, 0.48, 0.62, 0.77, 0.91, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  coverImage: { ...StyleSheet.absoluteFill },
});
const presentationBaselineStyles = styles;

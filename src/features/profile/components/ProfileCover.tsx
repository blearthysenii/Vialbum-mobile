import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';

export function ProfileCover({ source, canvas, dark, reduceMotion }: { source: string | null; canvas: string; dark: boolean; reduceMotion: boolean }) {
  const uri = useMemo(() => resolveApiImageUrl(source, 'profile.cover'), [source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(uri && failedUrl !== uri);
  const imageProgress = useSharedValue(0);
  const imageStyle = useAnimatedStyle(() => ({
    opacity: imageProgress.value,
    transform: [{ scale: reduceMotion ? 1 : 1.015 - imageProgress.value * 0.015 }],
  }));

  useEffect(() => {
    setFailedUrl(null);
  }, [uri]);

  return (
    <View style={styles.cover}>
      <LinearGradient colors={dark ? ['#28333E', '#12171D'] : ['#AFC0CD', '#D9C8B5']} style={StyleSheet.absoluteFill} />
      {showImage ? (
        <Animated.View style={[styles.coverImage, imageStyle]}>
          <Image
            source={cachedImageSource(uri!, `profile-cover:${uri?.split('?')[0]}`)}
            contentFit="cover"
            cachePolicy="disk"
            style={StyleSheet.absoluteFill}
            onLoad={() => { imageProgress.set(withTiming(1, { duration: reduceMotion ? 120 : 350, easing: Easing.out(Easing.cubic) })); }}
            onError={(response) => {
              setFailedUrl(uri);
              if (__DEV__) console.warn('[Profile cover] onError', { url: uri, response });
            }}
          />
        </Animated.View>
      ) : null}

      {/* Broad, shallow crest measured from the profile reference. */}
      <Svg
        pointerEvents="none"
        width="100%"
        height={150}
        viewBox="0 0 1000 150"
        preserveAspectRatio="none"
        style={styles.coverCurve}
      >
        <Path
          d="M0 146 C180 120 330 96 500 96 C670 96 820 120 1000 146 L1000 150 L0 150 Z"
          fill={canvas}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  coverImage: { ...StyleSheet.absoluteFill },
  coverCurve: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});

import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';

import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';
import { useProfileTheme } from '@/features/profile/theme';

export function ProfileAvatarImage({
  source,
  label,
  cacheKey,
  style,
  fallbackIconSize,
}: {
  source: string | null;
  label: string;
  cacheKey: string;
  style: StyleProp<ImageStyle>;
  fallbackIconSize: number;
}) {
  const theme = useProfileTheme();
  const uri = useMemo(() => {
    const raw = source?.trim();
    return raw && /^(file|content|ph):\/\//i.test(raw) ? raw : resolveApiImageUrl(source, label);
  }, [label, source]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showRemotePhoto = Boolean(uri && failedUrl !== uri);

  useEffect(() => {
    setFailedUrl(null);
  }, [uri]);

  if (!showRemotePhoto) {
    return (
      <View style={[style as StyleProp<ViewStyle>, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.placeholder }]}>
        <Ionicons name="person-outline" size={fallbackIconSize} color={theme.muted} />
      </View>
    );
  }

  return (
    <Image
      source={cachedImageSource(uri!, cacheKey)}
      style={style}
      contentFit="cover"
      cachePolicy="disk"
      transition={220}
      onError={(response) => {
        setFailedUrl(uri);
        if (__DEV__) console.warn('[Profile image] onError', { url: uri, response });
      }}
    />
  );
}

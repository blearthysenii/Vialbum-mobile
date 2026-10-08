import { resolvePresentationColor } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StableCachedImage } from '@/features/media/components/StableCachedImage';
import { memo, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { ImageStyle, StyleProp, ViewStyle } from 'react-native';

import { resolveApiImageUrl } from '@/features/media/imageUrl';
import { useProfileTheme } from '@/features/profile/theme';

export const ProfileAvatarImage = memo(function ProfileAvatarImage({
  source,
  label,
  cacheKey,
  style,
  fallbackIconSize,
  onSourceError,
}: {
  source: string | null;
  label: string;
  cacheKey: string;
  style: StyleProp<ImageStyle>;
  fallbackIconSize: number;
  onSourceError?: () => void;
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
      <View style={[style as StyleProp<ViewStyle>, { alignItems: 'center', justifyContent: 'center', backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>
        <Ionicons name="person-outline" size={fallbackIconSize} color={resolvePresentationColor(theme.muted, 'color', 'content')} />
      </View>
    );
  }

  return (
    <StableCachedImage
      uri={uri}
      namespace={cacheKey}
      style={style}
      contentFit="cover"
      onSourceError={onSourceError}
      onError={() => {
        setFailedUrl(uri);
        if (__DEV__) console.warn('[Profile image] onError', { hasSource: Boolean(uri), failed: true });
      }}
    />
  );
});

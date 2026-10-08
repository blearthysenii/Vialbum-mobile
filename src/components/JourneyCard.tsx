import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Journey } from '@/features/journeys/types';
import { prepareJourneyDetails } from '@/features/journeys/detailsCache';
import { cachedImageSource, resolveApiImageUrl } from '@/features/media/imageUrl';
import { colors } from '@/theme/colors';
import {
  shadows,
  typography,
} from '@/theme/tokens';

const CARD_HEIGHT = 220;
const CARD_RADIUS = 24;

function CardContent({
  journey,
}: {
  journey: Journey;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return (
    <>
      <View
        pointerEvents="none"
        style={styles.overlay}
      />

      <View style={styles.topLine}>
        <Text
          style={presentationTextStyle(styles.country)}
          numberOfLines={1}
        >
          {journey.country.toUpperCase()}
        </Text>

        <Text
          style={presentationTextStyle(styles.year)}
          numberOfLines={1}
        >
          {journey.start_date.slice(0, 4)}
        </Text>
      </View>

      <View style={styles.bottomContent}>
        <Text
          style={presentationTextStyle(styles.destination)}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {journey.title.toUpperCase()}
        </Text>

        <Text
          style={presentationTextStyle(styles.location)}
          numberOfLines={1}
        >
          {journey.destination}
        </Text>
      </View>
    </>
  );
}

export function JourneyCard({
  journey,
}: {
  journey: Journey;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [isOpening, setIsOpening] = useState(false);
  const coverUrl = resolveApiImageUrl(journey.cover_media_url, `journey.cover_media_url:${journey.id}`);
  const [failedCoverUrl, setFailedCoverUrl] = useState<string | null>(null);

  async function openJourney() {
    if (isOpening) return;
    setIsOpening(true);
    try {
      await prepareJourneyDetails(journey.id, journey);
      router.push({ pathname: '/post/[id]', params: { id: journey.id, scope: 'own' } });
    } catch {
      Alert.alert('Journey unavailable', 'This journey could not be opened. Please try again.');
    } finally {
      setIsOpening(false);
    }
  }

  return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${journey.title}`}
        accessibilityState={{ busy: isOpening, disabled: isOpening }}
        disabled={isOpening}
        onPress={() => void openJourney()}
        style={({ pressed }) => [
          styles.card,
          (pressed || isOpening) && styles.pressed,
        ]}
      >
        <View style={styles.clip}>
          {coverUrl && failedCoverUrl !== coverUrl ? (
            <>
              <Image
                source={cachedImageSource(coverUrl, `journey-cover:${journey.id}`)}
                contentFit="cover"
                contentPosition="center"
                cachePolicy="disk"
                style={styles.image}
                transition={200}
                onError={(response) => {
                  setFailedCoverUrl(coverUrl);
                  if (__DEV__) console.warn('[Journey card cover] onError', { url: coverUrl, response });
                }}
              />

              <View style={styles.content}>
                <CardContent
                  journey={journey}
                />
              </View>
            </>
          ) : (
            <View
              style={[
                styles.content,
                styles.placeholder,
              ]}
            >
              <View style={styles.sun} />

              <View style={styles.horizon} />

              <CardContent
                journey={journey}
              />
            </View>
          )}
          {isOpening ? <View pointerEvents="none" style={styles.opening}>
            <ActivityIndicator color={resolvePresentationColor(colors.onDark, 'color', 'content')} />
          </View> : null}
        </View>
      </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: CARD_HEIGHT,

    borderRadius: CARD_RADIUS,

    backgroundColor: '#66705E',

    ...shadows.card,
  },

  clip: {
    width: '100%',
    height: CARD_HEIGHT,

    borderRadius: CARD_RADIUS,

    overflow: 'hidden',

    backgroundColor: '#66705E',
  },

  pressed: {
    opacity: 0.92,

    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  opening: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,17,13,0.38)',
  },

  image: {
    position: 'absolute',
    inset: 0,

    width: '100%',
    height: '100%',
  },

  content: {
    position: 'absolute',
    inset: 0,

    justifyContent: 'space-between',

    paddingHorizontal: 24,
    paddingVertical: 19,
  },

  placeholder: {
    backgroundColor: '#677263',
  },

  sun: {
    position: 'absolute',

    width: 145,
    height: 145,

    borderRadius: 72.5,

    backgroundColor: '#D8B982',

    right: -18,
    top: 30,

    opacity: 0.72,
  },

  horizon: {
    position: 'absolute',

    height: 95,

    left: -20,
    right: -20,
    bottom: 0,

    backgroundColor: '#3E493F',

    transform: [
      {
        rotate: '-6deg',
      },
    ],
  },

  overlay: {
    position: 'absolute',
    inset: 0,

    backgroundColor:
      'rgba(18, 18, 14, 0.20)',
  },

  topLine: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    zIndex: 2,
  },

  country: {
    ...typography.eyebrow,

    flexShrink: 1,

    color: colors.onDark,
  },

  year: {
    ...typography.metadata,

    marginLeft: 16,

    color: colors.onDark,
  },

  bottomContent: {
    zIndex: 2,
  },

  destination: {
    ...typography.display,

    color: colors.surface,

    fontSize: 31,
    lineHeight: 33,

    letterSpacing: -1,
  },

  location: {
    ...typography.body,

    color:
      'rgba(255, 255, 255, 0.82)',

    marginTop: 7,
  },
});
const presentationBaselineStyles = styles;

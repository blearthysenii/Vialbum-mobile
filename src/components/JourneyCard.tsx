import { Link } from 'expo-router';
import { Image } from 'expo-image';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Journey } from '@/features/journeys/types';
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
  return (
    <>
      <View
        pointerEvents="none"
        style={styles.overlay}
      />

      <View style={styles.topLine}>
        <Text
          style={styles.country}
          numberOfLines={1}
        >
          {journey.country.toUpperCase()}
        </Text>

        <Text
          style={styles.year}
          numberOfLines={1}
        >
          {journey.start_date.slice(0, 4)}
        </Text>
      </View>

      <View style={styles.bottomContent}>
        <Text
          style={styles.destination}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {journey.title.toUpperCase()}
        </Text>

        <Text
          style={styles.location}
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
  return (
    <Link
      href={{
        pathname: '/journey/[id]',
        params: {
          id: journey.id,
        },
      }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${journey.title}`}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.clip}>
          {journey.cover_media_url ? (
            <>
              <Image
                source={journey.cover_media_url}
                contentFit="cover"
                contentPosition="center"
                cachePolicy="disk"
                style={styles.image}
                transition={200}
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
        </View>
      </Pressable>
    </Link>
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

import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Journey } from '@/features/journeys/types';
import { colors } from '@/theme/colors';
import { radii, shadows, typography } from '@/theme/tokens';

function CardContent({ journey }: { journey: Journey }) {
  return (
    <>
      <View style={styles.overlay} />
      <View style={styles.topLine}>
        <Text style={styles.country}>{journey.country.toUpperCase()}</Text>
        <Text style={styles.year}>{journey.start_date.slice(0, 4)}</Text>
      </View>
      <View>
        <Text style={styles.destination}>{journey.title.toUpperCase()}</Text>
        <Text style={styles.location}>{journey.destination}</Text>
      </View>
    </>
  );
}

export function JourneyCard({ journey }: { journey: Journey }) {
  return (
    <Link href={{ pathname: '/journey/[id]', params: { id: journey.id } }} asChild>
      <Pressable accessibilityLabel={`Open ${journey.title}`} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        {journey.cover_media_url ? (
          <View style={styles.content}>
            <Image source={journey.cover_media_url} contentFit="cover" cachePolicy="disk" style={StyleSheet.absoluteFill} transition={200} />
            <CardContent journey={journey} />
          </View>
        ) : (
          <View style={[styles.content, styles.placeholder]}>
            <View style={styles.sun} />
            <View style={styles.horizon} />
            <CardContent journey={journey} />
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { height: 390, borderRadius: radii.xl, backgroundColor: '#66705E', ...shadows.card, overflow: 'hidden' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  content: { flex: 1, justifyContent: 'space-between', padding: 22 },
  placeholder: { backgroundColor: '#677263' },
  sun: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: '#D8B982', right: -22, top: 48, opacity: 0.72 },
  horizon: { position: 'absolute', height: 130, left: -20, right: -20, bottom: 0, backgroundColor: '#3E493F', transform: [{ rotate: '-6deg' }] },
  overlay: { position: 'absolute', inset: 0, borderRadius: 28, backgroundColor: 'rgba(18,18,14,0.2)' },
  topLine: { flexDirection: 'row', justifyContent: 'space-between' },
  country: { ...typography.eyebrow, color: colors.onDark }, year: { ...typography.metadata, color: colors.onDark },
  destination: { ...typography.display, color: colors.surface, fontSize: 37, lineHeight: 40 }, location: { ...typography.body, color: 'rgba(255,255,255,0.82)', marginTop: 6 },
});

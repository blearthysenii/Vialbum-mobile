import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import type { JourneyMedia } from '@/features/media/types';
import { colors } from '@/theme/colors';

const gap = 5;
const size = (Dimensions.get('window').width - 48 - gap * 2) / 3;

export function PhotoGallery({ journeyId, media }: { journeyId: string; media: JourneyMedia[] }) {
  if (!media.length) return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>Your memories will appear here.</Text>
      <Text style={styles.emptyCopy}>Choose photographs that bring this journey back to life.</Text>
    </View>
  );
  return <View style={styles.grid}>{media.map((photo) => (
    <Pressable key={photo.id} onPress={() => router.push(`/journey/${journeyId}/photo/${photo.id}` as never)}>
      <Image source={photo.thumbnail_url ?? photo.url} style={styles.image} contentFit="cover" cachePolicy="disk" recyclingKey={photo.id} transition={180} />
    </Pressable>
  ))}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap, marginTop: 16 },
  image: { width: size, height: size, backgroundColor: '#E1DDD3' },
  empty: { backgroundColor: '#E8E3D8', borderRadius: 22, padding: 24, marginTop: 15 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  emptyCopy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});

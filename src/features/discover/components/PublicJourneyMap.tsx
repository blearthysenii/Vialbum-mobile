import { usePresentationStyles, presentationInterfaceStyle, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileTheme } from '@/features/profile/theme';
import { worldMapTarget } from '@/features/world/viewport';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import type { PublicJourneyDetail } from '../types';
import { publicMapPoints } from '../timeline';

export function PublicJourneyMap({ journey }: { journey: PublicJourneyDetail }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { user } = useAuth();
  const theme = useProfileTheme();
  const points = useMemo(() => publicMapPoints(journey), [journey]);
  if (!points.length) return null;
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const north = Math.max(...latitudes); const south = Math.min(...latitudes);
  const east = Math.max(...longitudes); const west = Math.min(...longitudes);
  return <View><View style={styles.map}>
    <MapView style={StyleSheet.absoluteFill} initialRegion={{ latitude: (north + south) / 2, longitude: (east + west) / 2, latitudeDelta: Math.max(0.08, (north - south) * 1.4), longitudeDelta: Math.max(0.08, (east - west) * 1.4) }} rotateEnabled={false} pitchEnabled={false} userInterfaceStyle={presentationInterfaceStyle()}>
      {points.map((point) => <Marker key={point.id} coordinate={point} />)}
    </MapView>
  </View>{journey.place ? <Pressable accessibilityRole="button" onPress={() => router.push(worldMapTarget(journey.creator.id === user?.id ? 'own' : 'explore', Number(journey.place!.latitude), Number(journey.place!.longitude)))} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>View on map</Text></Pressable> : null}</View>;
}
const styles = StyleSheet.create({ map: { height: 210, borderRadius: 22, overflow: 'hidden', marginTop: 22 } });
const presentationBaselineStyles = styles;

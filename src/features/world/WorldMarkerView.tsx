import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { ProfileTheme } from '@/features/profile/theme';
import type { WorldMarker } from './api';

export const WorldMarkerView = memo(function WorldMarkerView({ marker, theme, selected, onPress }: { marker: WorldMarker; theme: ProfileTheme; selected: boolean; onPress: (marker: WorldMarker) => void }) {
  const clustered = marker.type === 'cluster';
  return <Marker title={marker.name ?? undefined} coordinate={{ latitude: marker.latitude, longitude: marker.longitude }} accessibilityLabel={clustered ? `${marker.place_count} places, zoom in` : `${marker.name}, ${marker.journey_count} journeys`} onPress={event => { event.stopPropagation(); onPress(marker); }} tracksViewChanges={false}>
    <View style={[styles.marker, { backgroundColor: theme.canvas, borderColor: selected ? theme.accent : theme.border }, clustered && styles.cluster]}>{clustered ? <Text style={{ color: theme.ink, fontWeight: '700', fontSize: 15 }}>{marker.place_count}</Text> : <Ionicons name="location-outline" size={23} color={theme.ink} />}</View>
  </Marker>;
});
const styles = StyleSheet.create({ marker: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 4 }, cluster: { minWidth: 48, width: 'auto', paddingHorizontal: 12, height: 48, borderRadius: 24 } });

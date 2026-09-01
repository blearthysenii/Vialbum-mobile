import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker, type MarkerPressEvent } from 'react-native-maps';

import type { PreparedMapMarker } from '@/features/map/utils';
import { colors } from '@/theme/colors';

type Props = {
  marker: PreparedMapMarker;
  selected: boolean;
  onPress: (marker: PreparedMapMarker) => void;
};

export const MapMarkerView = memo(function MapMarkerView({ marker, selected, onPress }: Props) {
  const isCluster = marker.kind === 'cluster';
  const type = marker.kind === 'item' ? marker.item.type : null;
  const label = isCluster ? `${marker.items.length} items` : `${type}: ${marker.item.title}`;
  const press = (event: MarkerPressEvent) => {
    event.stopPropagation();
    onPress(marker);
  };
  return <Marker accessibilityLabel={label} coordinate={marker.coordinate} onPress={press} tracksViewChanges={false}>
    <View style={[
      styles.marker,
      isCluster && styles.cluster,
      type === 'journey' && styles.journey,
      type === 'memory' && styles.memory,
      type === 'photo' && styles.photo,
      selected && styles.selected,
    ]}>
      <Text style={[styles.text, type !== 'journey' && !isCluster && styles.subtleText]}>
        {isCluster ? marker.items.length : type === 'journey' ? 'V' : type === 'memory' ? 'M' : 'P'}
      </Text>
    </View>
  </Marker>;
});

const styles = StyleSheet.create({
  marker: { width: 29, height: 29, borderRadius: 15, backgroundColor: '#F4EFE5', borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  cluster: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accent, borderWidth: 3, borderColor: '#F4EFE5' },
  journey: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, borderColor: '#F4EFE5', borderWidth: 3 },
  memory: { backgroundColor: '#B75B3D', borderColor: '#F4EFE5' },
  photo: { backgroundColor: '#E7D8B7' },
  selected: { transform: [{ scale: 1.15 }], borderColor: colors.accent },
  text: { color: '#FFF', fontWeight: '900', fontSize: 13 },
  subtleText: { fontSize: 10 },
});

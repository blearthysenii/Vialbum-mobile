import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, QuietButton } from '@/components/ui/Button';
import { BackButton } from '@/components/ui/Headers';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, shadows, typography } from '@/theme/tokens';

type Coordinate = { latitude: number; longitude: number };

type Props = {
  latitude: string | null;
  longitude: string | null;
  onCancel: () => void;
  onChange: (coordinate: Coordinate | null) => void;
};

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#E8E3D8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5E5B53' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F4F1EA' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#BBC9C7' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#DED8CB' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#F7F4ED' }] },
];

export function JourneyLocationPicker({ latitude, longitude, onCancel, onChange }: Props) {
  const existing = latitude !== null && longitude !== null
    ? { latitude: Number(latitude), longitude: Number(longitude) }
    : null;
  const [selected, setSelected] = useState<Coordinate | null>(existing);
  const initialRegion = selected
    ? { ...selected, latitudeDelta: 0.12, longitudeDelta: 0.12 }
    : { latitude: 20, longitude: 0, latitudeDelta: 100, longitudeDelta: 100 };

  function select(event: MapPressEvent) {
    setSelected(event.nativeEvent.coordinate);
  }

  return <Modal animationType="slide" onRequestClose={onCancel}>
    <View style={styles.screen}>
      <MapView
        customMapStyle={mapStyle}
        initialRegion={initialRegion}
        onPress={select}
        rotateEnabled={false}
        style={StyleSheet.absoluteFill}
      >
        {selected ? <Marker coordinate={selected}><View style={styles.marker}><Text style={styles.markerText}>V</Text></View></Marker> : null}
      </MapView>
      <SafeAreaView style={styles.chrome} pointerEvents="box-none">
        <View style={styles.header}>
          <BackButton onPress={onCancel} />
          <View style={styles.copy}><Text style={styles.eyebrow}>JOURNEY LOCATION</Text><Text style={styles.title}>Tap the map to place it.</Text></View>
        </View>
        <View style={styles.sheet}>
          <Text style={styles.coordinates}>{selected ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : 'No position selected'}</Text>
          <View style={styles.actions}>
            {(selected || existing) ? <QuietButton onPress={() => onChange(null)}>Clear</QuietButton> : null}
            <PrimaryButton disabled={!selected} onPress={() => selected && onChange(selected)} style={styles.save}>Use This Position</PrimaryButton>
          </View>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, chrome: { flex: 1, justifyContent: 'space-between', padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copy: { backgroundColor: 'rgba(244,241,234,0.94)', borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, eyebrow: { ...typography.eyebrow, color: colors.accent, fontSize: 9 }, title: { ...typography.button, color: colors.ink, marginTop: 3 },
  sheet: { backgroundColor: colors.canvas, borderRadius: radii.lg, padding: 18, ...shadows.sheet }, coordinates: { ...typography.metadata, color: colors.muted, textAlign: 'center', marginBottom: 14 }, actions: { flexDirection: 'row', gap: spacing.sm }, save: { flex: 1 }, marker: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, markerText: { color: colors.onDark, fontWeight: '900' },
});

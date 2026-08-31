import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';

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
          <Pressable onPress={onCancel} style={styles.round}><Text style={styles.close}>×</Text></Pressable>
          <View style={styles.copy}><Text style={styles.eyebrow}>JOURNEY LOCATION</Text><Text style={styles.title}>Tap the map to place it.</Text></View>
        </View>
        <View style={styles.sheet}>
          <Text style={styles.coordinates}>{selected ? `${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : 'No position selected'}</Text>
          <View style={styles.actions}>
            {(selected || existing) ? <Pressable onPress={() => onChange(null)} style={styles.clear}><Text style={styles.clearText}>Clear</Text></Pressable> : null}
            <Pressable disabled={!selected} onPress={() => selected && onChange(selected)} style={[styles.save, !selected && styles.disabled]}><Text style={styles.saveText}>Use This Position</Text></Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas }, chrome: { flex: 1, justifyContent: 'space-between', padding: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 }, round: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(244,241,234,0.94)', alignItems: 'center', justifyContent: 'center' }, close: { fontSize: 28, lineHeight: 30, color: colors.ink },
  copy: { backgroundColor: 'rgba(244,241,234,0.94)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 }, eyebrow: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 }, title: { color: colors.ink, fontWeight: '800', marginTop: 3 },
  sheet: { backgroundColor: colors.canvas, borderRadius: 22, padding: 18, shadowColor: '#171713', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, coordinates: { color: colors.muted, fontSize: 13, textAlign: 'center', marginBottom: 14 }, actions: { flexDirection: 'row', gap: 10 },
  clear: { paddingHorizontal: 18, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' }, clearText: { color: '#A33D2D', fontWeight: '800' }, save: { flex: 1, minHeight: 52, borderRadius: 15, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.4 }, saveText: { color: '#FFF', fontWeight: '800' }, marker: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.ink, borderWidth: 3, borderColor: colors.canvas, alignItems: 'center', justifyContent: 'center' }, markerText: { color: '#FFF', fontWeight: '900' },
});

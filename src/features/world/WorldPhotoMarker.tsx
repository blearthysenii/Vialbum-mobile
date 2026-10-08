import { useThemedMarker } from '@/theme/useThemedMarker';
import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { ProfileTheme } from '@/features/profile/theme';
import type { WorldPhoto } from './api';

export function WorldPhotoMarker({ photos, theme, onPress }: { photos: WorldPhoto[]; theme: ProfileTheme; onPress: (photos: WorldPhoto[]) => void }) {
  const markerRef = useThemedMarker();
  const photo = photos[0];
  const [loaded, setLoaded] = useState(false);
  return <Marker ref={markerRef} title={photo.display_name} coordinate={{ latitude: photo.latitude, longitude: photo.longitude }} tracksViewChanges={!loaded} accessibilityLabel={photos.length > 1 ? `${photos.length} photos at ${photo.place_name}` : photo.display_name} onPress={event => { event.stopPropagation(); onPress(photos); }}>
    <View style={{ width: 48, height: 52, padding: 3, borderRadius: 13, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'content'), borderWidth: 1, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}>
      <Image source={photo.thumbnail_url} cachePolicy="none" style={{ flex: 1, borderRadius: 9 }} onLoadEnd={() => setLoaded(true)} />
      {photos.length > 1 ? <Text style={presentationTextStyle({ position: 'absolute', bottom: 0, right: 0, borderRadius: 8, paddingHorizontal: 5, backgroundColor: resolvePresentationColor(theme.ink, 'backgroundColor', 'content'), color: resolvePresentationColor(theme.canvas, 'color', 'content'), fontWeight: '600' })}>{photos.length}</Text> : null}
    </View>
  </Marker>;
}

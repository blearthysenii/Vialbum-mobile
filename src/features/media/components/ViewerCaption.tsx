import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { photoCoordinate, photoDay, type LocatedPhoto } from '../photoContext';

export function ViewerCaption({ photo, startDate, onLocation }: { photo: LocatedPhoto & { caption: string | null }; startDate?: string; onLocation?: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const day = photoDay(photo, startDate);
  const location = photoCoordinate(photo) && onLocation;
  return <View style={styles.root}>
    {day || location ? <View style={styles.context}>
      {day ? <Text style={presentationTextStyle(styles.day)}>{day}</Text> : null}
      {location ? <Pressable accessibilityRole="button" accessibilityLabel={`Show ${photo.place?.name ?? 'photo location'} on map`} onPress={onLocation} style={styles.location}>
        <Ionicons name="location-outline" size={14} color={resolvePresentationColor("#DDDDDD", 'color', 'content')} /><Text numberOfLines={1} style={presentationTextStyle(styles.place)}>{photo.place?.name ?? 'View on map'}</Text>
      </Pressable> : null}
    </View> : null}
    {photo.caption?.trim() ? <Text numberOfLines={3} style={presentationTextStyle(styles.caption)}>{photo.caption.trim()}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({ root: { gap: 4 }, context: { flexDirection: 'row', alignItems: 'center', gap: 14 }, day: { color: '#BBBBBB', fontSize: 12 }, location: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44, flexShrink: 1 }, place: { color: '#DDDDDD', fontSize: 12, flexShrink: 1 }, caption: { color: '#EEEEEE', fontSize: 14, lineHeight: 20 } });
const presentationBaselineStyles = styles;

import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { MappedItem } from '@/features/map/utils';
import { mapItemDayNumber, mapItemKey } from '@/features/map/utils';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { radii, shadows, typography } from '@/theme/tokens';
import { formatCalendarDate, formatCoordinates, formatDateRange } from '@/utils/format';

type ItemCardProps = {
  item: MappedItem;
  thumbnailUrl: string | null;
  onOpen: () => void;
};

export function MapSelectionCard({ item, thumbnailUrl, onOpen }: ItemCardProps) {
  const day = mapItemDayNumber(item);
  const date = item.type === 'journey'
    ? formatDateRange(item.journey_start_date, item.journey_end_date)
    : [item.date ? formatCalendarDate(item.date) : null, day !== null ? `Day ${day}` : null].filter(Boolean).join(' · ');
  const location = item.location
    ?? (item.type === 'journey' ? item.subtitle : formatCoordinates(item.latitude, item.longitude));
  const context = item.type === 'photo' && item.memory_title
    ? [location, `Memory · ${item.memory_title}`].filter(Boolean).join(' · ')
    : location ?? item.subtitle;
  return <SafeAreaView style={styles.wrap} edges={['bottom']} pointerEvents="box-none">
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.type} ${item.title}`} style={styles.card} onPress={onOpen}>
      <View style={styles.thumbnail}>{thumbnailUrl ? <Image source={thumbnailUrl} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={mapItemKey(item)} /> : <Text style={styles.placeholder}>V</Text>}</View>
      <View style={styles.body}>
        <Text style={styles.kind}>{item.type.toUpperCase()}</Text>
        <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
        {item.caption ? <Text numberOfLines={2} style={styles.caption}>{item.caption}</Text> : null}
        {context ? <Text numberOfLines={1} style={styles.meta}>{context}</Text> : null}
        {date ? <Text numberOfLines={1} style={styles.meta}>{date}</Text> : null}
      </View>
      <Text accessibilityElementsHidden style={styles.chevron}>›</Text>
    </Pressable>
  </SafeAreaView>;
}

type GroupProps = {
  items: MappedItem[];
  onSelect: (item: MappedItem) => void;
  onClose: () => void;
};

export function MapOverlapCard({ items, onSelect, onClose }: GroupProps) {
  return <SafeAreaView style={styles.wrap} edges={['bottom']} pointerEvents="box-none">
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <View><Text style={styles.kind}>SAME PLACE</Text><Text style={styles.groupTitle}>{items.length} moments here</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close grouped map items" onPress={onClose} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupItems}>
        {items.map((item) => <Pressable accessibilityRole="button" accessibilityLabel={`Select ${item.type} ${item.title}`} key={mapItemKey(item)} onPress={() => onSelect(item)} style={styles.groupItem}>
          <Text style={styles.kind}>{item.type.toUpperCase()}</Text>
          <Text numberOfLines={2} style={styles.groupItemTitle}>{item.title}</Text>
          <Text numberOfLines={1} style={styles.meta}>{item.location ?? item.subtitle}</Text>
        </Pressable>)}
      </ScrollView>
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 14, right: 14, bottom: 12 },
  card: { minHeight: 122, flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: radii.lg, backgroundColor: '#F6F3EC', ...shadows.sheet },
  thumbnail: { width: 86, height: 86, borderRadius: radii.md, overflow: 'hidden', backgroundColor: '#DED8CC', alignItems: 'center', justifyContent: 'center' },
  placeholder: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  body: { flex: 1, paddingHorizontal: 14 }, kind: { ...typography.eyebrow, color: colors.accent, fontSize: 9 },
  title: { ...typography.cardTitle, marginTop: 4, color: colors.ink }, caption: { ...typography.metadata, marginTop: 4, color: colors.ink, fontWeight: '400' },
  meta: { ...typography.metadata, marginTop: 4, color: colors.muted, fontSize: 11 }, chevron: { color: colors.muted, fontSize: 30, paddingRight: 4 },
  group: { borderRadius: radii.lg, backgroundColor: '#F6F3EC', padding: spacing.md, ...shadows.sheet },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, groupTitle: { ...typography.cardTitle, color: colors.ink, marginTop: 3 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: 28, color: colors.muted },
  groupItems: { gap: spacing.sm, paddingTop: spacing.md }, groupItem: { width: 150, minHeight: 86, padding: spacing.sm, borderRadius: radii.md, backgroundColor: colors.surfaceWarm },
  groupItemTitle: { ...typography.button, color: colors.ink, marginTop: 5 },
});

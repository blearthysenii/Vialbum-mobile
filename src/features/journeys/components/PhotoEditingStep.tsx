import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import type { NativeGesture } from 'react-native-gesture-handler';
import { VideoEditor } from '@/features/media/components/VideoEditor';
import type { VideoEdit } from '@/features/media/videoEdit';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { ProfileTheme } from '@/features/profile/theme';
import type { DraftPhoto } from '../draft';
import { colors } from '@/theme/colors';

export function PhotoEditingStep({ photos, activeKey, coverKey, theme, onActive, onCaption, onLocation, onCover, onMove, onRemove, onAdd, onReplace, onVideoEdit, scrollGesture }: {
  scrollGesture?: NativeGesture; photos: DraftPhoto[]; activeKey: string | null; coverKey: string | null; theme: ProfileTheme;
  onActive: (key: string) => void; onCaption: (key: string, text: string) => void;
  onLocation: (key: string) => void; onCover: (key: string) => void;
  onMove: (key: string, offset: number) => void; onRemove: (key: string) => void;
  onVideoEdit: (key: string, edit: VideoEdit) => void;
  onAdd: () => void; onReplace: (key: string) => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const { height: screenHeight } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const pager = useRef<FlatList<DraftPhoto>>(null);
  const current = photos.find(photo => photo.key === activeKey) ?? photos[0];
  const index = current ? photos.indexOf(current) : 0;
  const stageHeight = Math.min(350, Math.max(180, screenHeight * 0.34));
  useEffect(() => { if (width) pager.current?.scrollToOffset({ offset: index * width, animated: false }); }, [index, width, photos.length]);
  if (!current) return <View style={styles.empty}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Add a photo to continue.</Text><Pressable accessibilityRole="button" onPress={onAdd} style={styles.button}><Text style={presentationTextStyle(styles.blue)}>Add photos</Text></Pressable></View>;
  return <>
    {current.type === 'video' && !current.unavailable ? <VideoEditor scrollGesture={scrollGesture} key={current.key} uri={current.uri} duration={current.duration} edit={current.videoEdit} onChange={edit => onVideoEdit(current.key, edit)} theme={theme} /> : <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={[styles.stage, { height: stageHeight, backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'content') }]}>
      {width > 0 ? <FlatList ref={pager} data={photos} horizontal pagingEnabled initialScrollIndex={index} getItemLayout={(_, i) => ({ length: width, offset: i * width, index: i })} keyExtractor={photo => photo.key} showsHorizontalScrollIndicator={false} initialNumToRender={2} maxToRenderPerBatch={2} windowSize={3}
        onMomentumScrollEnd={event => { const next = Math.max(0, Math.min(photos.length - 1, Math.round(event.nativeEvent.contentOffset.x / width))); onActive(photos[next].key); }}
        renderItem={({ item }) => <View style={{ width, height: stageHeight }}>{item.unavailable ? <View style={styles.empty}><Ionicons name="image-outline" size={32} color={resolvePresentationColor(theme.muted, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>This photo is no longer available.</Text><Pressable accessibilityRole="button" onPress={() => onReplace(item.key)} style={styles.button}><Text style={presentationTextStyle(styles.blue)}>Replace photo</Text></Pressable></View> : <Image source={{ uri: item.uri }} recyclingKey={item.key} contentFit="contain" style={StyleSheet.absoluteFill} />}</View>} /> : null}
      {photos.length > 1 ? <View pointerEvents="none" style={styles.count}><Text style={presentationTextStyle(styles.countText)}>{index + 1} of {photos.length}</Text></View> : null}
    </View>}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.thumbnails}>
      {photos.map((photo, i) => <Pressable key={photo.key} accessibilityRole="button" accessibilityLabel={`Edit photo ${i + 1}${photo.key === coverKey ? ', journey cover' : ''}`} accessibilityState={{ selected: photo.key === current.key }} onPress={() => onActive(photo.key)} style={[styles.thumbnail, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control'), borderColor: resolvePresentationColor(theme.border, 'borderColor', 'control') }, photo.key === current.key && styles.activeThumbnail]}>
        {photo.unavailable ? <Ionicons name="alert-circle-outline" size={24} color={resolvePresentationColor(theme.muted, 'color', 'content')} /> : <>{photo.type === 'video' ? <Ionicons name="videocam-outline" size={24} color={resolvePresentationColor(theme.ink, 'color', 'content')} /> : <Image source={{ uri: photo.uri }} contentFit="cover" style={styles.thumbnailImage} />}</>}
        {photo.key === coverKey ? <Ionicons name="star" size={13} color={resolvePresentationColor("white", 'color', 'content')} style={styles.star} /> : null}
      </Pressable>)}
      <Pressable accessibilityRole="button" accessibilityLabel="Add more photos" onPress={onAdd} style={[styles.add, { backgroundColor: resolvePresentationColor(theme.placeholder, 'backgroundColor', 'control') }]}><Ionicons name="add" size={25} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>
    </ScrollView>
    <View style={styles.tools}>
      <Tool icon="arrow-back" label="Move earlier" disabled={index === 0} color={resolvePresentationColor(index === 0 ? theme.subtle : theme.ink, 'color', 'content')} onPress={() => onMove(current.key, -1)} />
      <Tool icon="arrow-forward" label="Move later" disabled={index === photos.length - 1} color={resolvePresentationColor(index === photos.length - 1 ? theme.subtle : theme.ink, 'color', 'content')} onPress={() => onMove(current.key, 1)} />
      <Tool icon="trash-outline" label="Remove" color={resolvePresentationColor(theme.ink, 'color', 'content')} onPress={() => onRemove(current.key)} />
    </View>
    <Pressable accessibilityRole="radio" accessibilityLabel="Use as journey cover" accessibilityState={{ checked: current.key === coverKey }} onPress={() => onCover(current.key)} style={[styles.row, { backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'surface'), borderWidth: StyleSheet.hairlineWidth, borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }]}><Ionicons name={current.key === coverKey ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={resolvePresentationColor(colors.accent, 'color', 'content')} /><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), fontSize: 15 })}>Use as journey cover</Text></Pressable>
    <View style={[styles.captionCard, { backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'surface'), borderWidth: StyleSheet.hairlineWidth, borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }]}>
      <Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Caption for {current.type === 'video' ? 'video' : 'photo'} {index + 1}</Text>
      <TextInput key={current.key} accessibilityLabel="Caption for this photo" keyboardAppearance={theme.dark ? 'dark' : 'light'} selectionColor={colors.accent} multiline submitBehavior="newline" value={current.caption} onChangeText={text => onCaption(current.key, Array.from(text).slice(0, 100).join(''))} placeholder="Write a caption…" placeholderTextColor={resolvePresentationColor(theme.subtle, 'placeholderTextColor', 'control')} textAlignVertical="top" style={presentationTextStyle([styles.caption, { color: resolvePresentationColor(theme.ink, 'color', 'control') }])} />
      <Text style={presentationTextStyle([styles.counter, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>{Array.from(current.caption).length}/100</Text>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel="Edit this photo’s optional location" onPress={() => onLocation(current.key)} style={[styles.row, { backgroundColor: resolvePresentationColor(theme.glassStrong, 'backgroundColor', 'surface'), borderWidth: StyleSheet.hairlineWidth, borderColor: resolvePresentationColor(theme.border, 'borderColor', 'surface') }]}><Ionicons name="location-outline" size={22} color={resolvePresentationColor(colors.accent, 'color', 'content')} /><View style={styles.flex}><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.muted, 'color', 'content') }])}>Photo location · Optional</Text><Text numberOfLines={2} style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), marginTop: 5 })}>{current.place?.name ?? (current.latitude !== undefined ? 'Location attached' : 'Add a place')}</Text></View><Ionicons name="chevron-forward" size={16} color={resolvePresentationColor(theme.subtle, 'color', 'content')} /></Pressable>
  </>;
}
function Tool({ icon, label, disabled, color, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; disabled?: boolean; color: string; onPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.tool, disabled && { opacity: 0.3 }]}><Ionicons name={icon} size={20} color={resolvePresentationColor(color, 'color', 'content')} /><Text style={presentationTextStyle({ color, fontSize: 12 })}>{label}</Text></Pressable>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, stage: { borderRadius: 18, overflow: 'hidden' }, count: { position: 'absolute', right: 12, top: 12, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.45)' }, countText: { fontSize: 11, color: 'white' }, thumbnails: { gap: 8, paddingVertical: 2 }, thumbnail: { width: 60, height: 72, borderWidth: 2, borderColor: 'transparent', borderRadius: 11, padding: 2, alignItems: 'center', justifyContent: 'center' }, activeThumbnail: { borderColor: colors.accent }, thumbnailImage: { width: '100%', height: '100%', borderRadius: 7 }, star: { position: 'absolute', right: 7, bottom: 7 }, add: { width: 60, height: 72, alignItems: 'center', justifyContent: 'center', borderRadius: 11 }, tools: { flexDirection: 'row' }, tool: { flex: 1, minHeight: 44, gap: 5, alignItems: 'center', justifyContent: 'center' }, row: { flexDirection: 'row', alignItems: 'center', padding: 14, minHeight: 54, borderRadius: 15, gap: 10 }, captionCard: { borderRadius: 15, padding: 14 }, label: { fontSize: 12 }, caption: { minHeight: 70, maxHeight: 140, paddingTop: 9, fontSize: 16, lineHeight: 22 }, counter: { textAlign: 'right', fontSize: 11 }, blue: { color: colors.accent, fontSize: 16, fontWeight: '600' }, button: { minHeight: 44, justifyContent: 'center' }, empty: { flex: 1, minHeight: 160, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 10 } });
const presentationBaselineStyles = styles;

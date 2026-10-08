import { usePresentationStyles, resolvePresentationColor, presentationInterfaceStyle, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProfileTheme } from '@/features/profile/theme';
import { reorderStop, type DraftStop } from '../stops';

export function JourneyStopsEditor({ stops, media, theme, onSave, onClose, closeAfterSave = true, disabled = false }: {
  stops: DraftStop[]; media: { key: string; name: string }[]; theme: ProfileTheme;
  closeAfterSave?: boolean; disabled?: boolean;
  onSave: (stops: DraftStop[]) => void; onClose: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles, 'surface');

  const [items, setItems] = useState(stops);
  const [associating, setAssociating] = useState<string | null>(null);
  const reorder = (index: number, offset: number) => { setItems(old => reorderStop(old, index, offset)); void Haptics.selectionAsync().catch(() => undefined); };
  const assign = (key: string, stopId: string) => setItems(old => old.map(stop => ({ ...stop, mediaKeys: stop.id === stopId ? [...stop.mediaKeys.filter(value => value !== key), key] : stop.mediaKeys.filter(value => value !== key) })));
  return <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.screen, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface') }]}>
    <View style={styles.header}><Pressable disabled={disabled} onPress={onClose}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Cancel</Text></Pressable><Text style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Journey stops</Text><Pressable disabled={disabled} onPress={() => { onSave(items); if (closeAfterSave) onClose(); }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content') })}>Done</Text></Pressable></View>
    <ScrollView pointerEvents={disabled ? 'none' : 'auto'} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {!items.length ? <Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>Add locations to your media to build your journey stops.</Text> : null}
      {items.map((stop, index) => <View key={stop.id} style={styles.stop}>
        <View style={styles.route}><View style={[styles.dot, { backgroundColor: resolvePresentationColor(theme.accent, 'backgroundColor', 'content') }]} />{index < items.length - 1 ? <View style={[styles.line, { backgroundColor: resolvePresentationColor(theme.border, 'backgroundColor', 'content') }]} /> : null}</View>
        <View style={styles.body}><TextInput accessibilityLabel="Stop label" value={stop.label} maxLength={160} onChangeText={label => setItems(old => old.map(item => item.id === stop.id ? { ...item, label } : item))} style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.ink, 'color', 'control') }])} keyboardAppearance={presentationInterfaceStyle()} />
          <Pressable onPress={() => setAssociating(value => value === stop.id ? null : stop.id)}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{stop.mediaKeys.length} media · Associate media</Text></Pressable>
          {associating === stop.id ? media.map(item => <Pressable key={item.key} style={styles.association} onPress={() => stop.mediaKeys.includes(item.key) ? setItems(old => old.map(value => value.id === stop.id ? { ...value, mediaKeys: value.mediaKeys.filter(key => key !== item.key) } : value)) : assign(item.key, stop.id)}><Ionicons name={stop.mediaKeys.includes(item.key) ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={resolvePresentationColor(theme.accent, 'color', 'content')} /><Text numberOfLines={1} style={presentationTextStyle({ color: resolvePresentationColor(theme.ink, 'color', 'content'), flex: 1 })}>{item.name}</Text></Pressable>) : null}
        </View>
        <View><Control label="Move stop earlier" icon="chevron-up" theme={theme} disabled={index === 0} onPress={() => reorder(index, -1)} /><Control label="Move stop later" icon="chevron-down" theme={theme} disabled={index === items.length - 1} onPress={() => reorder(index, 1)} /><Control label="Remove stop" icon="close" theme={theme} onPress={() => setItems(old => old.filter(item => item.id !== stop.id))} /></View>
      </View>)}
    </ScrollView>
  </SafeAreaView></Modal>;
}
function Control({ label, icon, theme, disabled, onPress }: { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; theme: ProfileTheme; disabled?: boolean; onPress: () => void }) {
  const styles = usePresentationStyles(presentationBaselineStyles, 'surface');
 return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.control, disabled && { opacity: 0.25 }]}><Ionicons name={icon} size={18} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></Pressable>; }
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { minHeight: 56, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, title: { fontWeight: '600', fontSize: 17 }, content: { padding: 20, gap: 8 }, stop: { flexDirection: 'row', gap: 12 }, route: { alignItems: 'center', width: 12, paddingTop: 18 }, dot: { width: 9, height: 9, borderRadius: 5 }, line: { width: 1, flex: 1, marginTop: 8 }, body: { flex: 1, paddingVertical: 8, gap: 9 }, label: { fontSize: 17, fontWeight: '500', minHeight: 32 }, control: { minWidth: 44, minHeight: 36, justifyContent: 'center', alignItems: 'center' }, association: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 } });
const presentationBaselineStyles = styles;

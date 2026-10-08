import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { useProfileTheme } from '@/features/profile/theme';

export function CreateJourneySheet({ visible, draftCount, onClose, onChoose }: {
  visible: boolean; draftCount: number; onClose: () => void; onChoose: (target: 'new' | 'moment' | 'drafts') => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles, 'surface');

  const theme = useProfileTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const y = useRef(new Animated.Value(400)).current;
  const pending = useRef<'new' | 'moment' | 'drafts' | null>(null);
  const closing = useRef(false);
  const closeRef = useRef(() => {});
  const finishChoice = () => { const target = pending.current; pending.current = null; if (target) onChoose(target); };
  closeRef.current = () => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(y, { toValue: 400, duration: reducedMotion ? 0 : 180, useNativeDriver: true }).start(() => {
      onClose();
      if (Platform.OS !== 'ios') requestAnimationFrame(finishChoice);
    });
  };
  useEffect(() => {
    if (!visible) return;
    pending.current = null; closing.current = false; y.setValue(reducedMotion ? 0 : 400);
    Animated.spring(y, { toValue: 0, damping: 26, stiffness: 280, mass: 0.8, useNativeDriver: true }).start();
  }, [visible, y, reducedMotion]);
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => y.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 65 || gesture.vy > 0.7) closeRef.current();
      else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(y, { toValue: 0, useNativeDriver: true }).start(),
  }), [y]);
  const choose = (target: 'new' | 'moment' | 'drafts') => { pending.current = target; closeRef.current(); };
  return <Modal visible={visible} transparent statusBarTranslucent animationType="none" onRequestClose={() => closeRef.current()} onDismiss={finishChoice}>
    <Pressable accessibilityRole="button" accessibilityLabel="Dismiss Create sheet" onPress={() => closeRef.current()} style={styles.backdrop} />
    <Animated.View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface'), paddingBottom: Math.max(insets.bottom, 14), transform: [{ translateY: y }] }]}>
      <View {...pan.panHandlers} style={styles.heading}><View style={[styles.handle, { backgroundColor: resolvePresentationColor(theme.divider, 'backgroundColor', 'content') }]} /><Text accessibilityRole="header" style={presentationTextStyle([styles.title, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Create</Text></View>
      <Pressable accessibilityRole="button" onPress={() => choose('new')} style={styles.row}><Ionicons name="images-outline" size={26} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>New journey</Text><Ionicons name="chevron-forward" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></Pressable>
      <Pressable accessibilityRole="button" onPress={() => choose('moment')} style={styles.row}><Ionicons name="videocam-outline" size={26} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>New moment</Text><Ionicons name="chevron-forward" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></Pressable>
      {draftCount > 0 ? <Pressable accessibilityRole="button" onPress={() => choose('drafts')} style={styles.row}><Ionicons name="document-text-outline" size={26} color={resolvePresentationColor(theme.ink, 'color', 'content')} /><Text style={presentationTextStyle([styles.label, { color: resolvePresentationColor(theme.ink, 'color', 'content') }])}>Drafts</Text><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content') })}>{draftCount}</Text><Ionicons name="chevron-forward" size={18} color={resolvePresentationColor(theme.muted, 'color', 'content')} /></Pressable> : null}
    </Animated.View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' }, sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20 }, heading: { paddingTop: 9, paddingBottom: 14, alignItems: 'center', gap: 17 }, handle: { width: 36, height: 5, borderRadius: 3 }, title: { fontSize: 18, fontWeight: '600' }, row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 15 }, label: { flex: 1, fontSize: 17 },
});
const presentationBaselineStyles = styles;

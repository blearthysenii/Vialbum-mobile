import { usePresentationStyles, resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActionSheetIOS, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileTheme } from '@/features/profile/theme';
export type MomentOption = { title: string; run: () => void; destructive?: boolean };
export function MomentOptions({ actions, onOpen, onClose, onAnchorLayout }: {
  onAnchorLayout?: (bottom: number) => void; actions: MomentOption[]; onOpen: () => void; onClose: () => void;
}) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const [open, setOpen] = useState(false);
  const theme = useProfileTheme(); const insets = useSafeAreaInsets();
  const dismiss = (index?: number) => { setOpen(false); onClose(); if (index !== undefined) actions[index]?.run(); };
  const show = () => {
    onOpen();
    if (Platform.OS === 'ios') {
      const destructive = actions.findIndex(action => action.destructive);
      ActionSheetIOS.showActionSheetWithOptions({
        options: [...actions.map(action => action.title), 'Cancel'], cancelButtonIndex: actions.length,
        ...(destructive >= 0 ? { destructiveButtonIndex: destructive } : {}),
        userInterfaceStyle: theme.dark ? 'dark' : 'light',
      }, index => dismiss(index));
    } else setOpen(true);
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel="Moment options" onPress={show} style={styles.button}
      onLayout={event => {
        const { y, height } = event.nativeEvent.layout;
        // Anchor to the visible dots (6pt high), centered in the unchanged 44pt hit target.
        onAnchorLayout?.(y + height / 2 + 3);
      }}>
      <Ionicons name="ellipsis-horizontal" size={27} color={resolvePresentationColor("white", 'color', 'content')} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => dismiss()}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Dismiss Moment options" style={{ flex: 1 }} onPress={() => dismiss()} />
        <View style={[styles.sheet, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'surface'), paddingBottom: Math.max(insets.bottom, 16) }]}>
          {actions.map((action, index) => <Pressable key={action.title} accessibilityRole="button" style={styles.option} onPress={() => dismiss(index)}>
            <Text style={presentationTextStyle({ color: resolvePresentationColor(action.destructive ? theme.danger : theme.ink, 'color', 'content'), fontSize: 17 })}>{action.title}</Text>
          </Pressable>)}
          <Pressable style={styles.option} onPress={() => dismiss()}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.muted, 'color', 'content'), fontSize: 17 })}>Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  option: { minHeight: 48, justifyContent: 'center' },
});
const presentationBaselineStyles = styles;

import { BlurView } from 'expo-blur';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import type { ProfileTheme } from '@/features/profile/theme';

export function PostGlassButton({ children, label, onPress, theme }: PropsWithChildren<{ label: string; onPress: () => void; theme: ProfileTheme }>) {
  return <View style={styles.shadow}><Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: theme.glass, borderColor: theme.border, opacity: pressed ? 0.65 : 1 }]}>
    {Platform.OS === 'ios' ? <BlurView pointerEvents="none" intensity={30} tint={theme.dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={StyleSheet.absoluteFill} /> : null}
    {children}
  </Pressable></View>;
}
const styles = StyleSheet.create({ shadow: { width: 44, height: 44, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 }, button: { width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' } });

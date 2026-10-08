import { memo, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, Keyboard, Platform, StyleSheet, View } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { GlassViewProps } from 'expo-glass-effect';
import type { ComponentType } from 'react';
import { darkPalette } from '@/theme/palette';

// Older development clients may not contain this optional native module. Check
// both compiled design support and runtime API availability before loading it.
function nativeGlassView(): ComponentType<GlassViewProps> | null {
  if (Platform.OS !== 'ios') return null;
  try {
    const native = requireOptionalNativeModule('ExpoGlassEffect');
    if (native?.isLiquidGlassAvailable !== true || native?.isGlassEffectAPIAvailable !== true) return null;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Avoid evaluating the native view manager in older development clients.
    return require('expo-glass-effect').GlassView;
  } catch { return null; }
}
const NativeGlass = nativeGlassView();

export function navigationMaterial(platform: string, nativeAvailable: boolean, reduceTransparency: boolean) {
  return reduceTransparency ? 'opaque' : platform === 'ios' && nativeAvailable ? 'native' : platform === 'ios' ? 'blur' : 'opaque';
}

export function useNavigationEnvironment() {
  // Start with the accessible surface until the asynchronous preference is known.
  const [reduceTransparency, setReduceTransparency] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  useEffect(() => {
    let alive = true, revision = 0;
    const refresh = () => {
      const request = ++revision;
      void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
        if (alive && request === revision) setReduceTransparency(value);
      }).catch(() => {});
      setKeyboardVisible(Keyboard.isVisible());
    };
    refresh();
    const accessibility = AccessibilityInfo.addEventListener('reduceTransparencyChanged', value => {
      revision++; setReduceTransparency(value);
    });
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { alive = false; accessibility.remove(); show.remove(); hide.remove(); foreground.remove(); };
  }, []);
  return { reduceTransparency, keyboardVisible };
}

// Decorative views only: material changes never own navigation or media state.
export const NavigationGlass = memo(function NavigationGlass({ dark, selected = false, radius, reduceTransparency }: {
  dark: boolean; selected?: boolean; radius: number; reduceTransparency: boolean;
}) {
  const mode = navigationMaterial(Platform.OS, NativeGlass !== null, reduceTransparency);
  useEffect(() => {
    if (__DEV__ && !selected) console.debug('[Navigation glass]', { mode, dark, reduceTransparency });
  }, [mode, dark, reduceTransparency, selected]);
  const shape = { borderRadius: radius, borderCurve: 'continuous' as const };
  const solid = dark ? selected ? darkPalette.control : darkPalette.surface : selected ? '#E8E8EC' : '#F5F5F7';
  if (mode === 'opaque') return <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, { backgroundColor: solid }]} />;
  if (mode === 'native' && NativeGlass) return <NativeGlass pointerEvents="none" colorScheme={dark ? 'dark' : 'light'} isInteractive={false}
    glassEffectStyle={selected ? 'clear' : 'regular'} tintColor={selected ? dark ? 'rgba(161,161,170,0.14)' : 'rgba(255,255,255,0.20)' : undefined}
    style={[StyleSheet.absoluteFill, shape]} />;
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, shape, styles.clip]}>
    <BlurView intensity={selected ? 48 : 64} tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, { backgroundColor: dark ? selected ? 'rgba(37,38,44,0.46)' : 'rgba(26,27,32,0.30)' : selected ? 'rgba(255,255,255,0.36)' : 'rgba(255,255,255,0.20)' }]} />
    <LinearGradient pointerEvents="none" colors={dark ? ['rgba(245,245,247,0.08)', 'rgba(245,245,247,0)', 'rgba(245,245,247,0.025)'] : ['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0.08)']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
    <View style={[StyleSheet.absoluteFill, shape, { borderWidth: StyleSheet.hairlineWidth, borderColor: dark ? 'rgba(161,161,170,0.18)' : 'rgba(255,255,255,0.64)' }]} />
  </View>;
});
const styles = StyleSheet.create({ clip: { overflow: 'hidden' } });

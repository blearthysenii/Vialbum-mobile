import { useAppColorScheme as useColorScheme } from '@/theme/appearance';
import { darkPalette } from '@/theme/palette';

export const authLightColors = {
  canvas: '#FFFFFF',
  surface: 'rgba(255, 255, 255, 0.68)',
  surfaceStrong: 'rgba(255, 255, 255, 0.82)',
  inputText: '#111111',
  title: '#0A0A0A',
  body: '#6E6E73',
  placeholder: 'rgba(60, 60, 67, 0.45)',
  label: '#6E6E73',
  separator: 'rgba(60, 60, 67, 0.16)',
  glassBorder: 'rgba(60, 60, 67, 0.22)',
  glassHighlight: 'rgba(255, 255, 255, 0.98)',
  control: 'rgba(255, 255, 255, 0.74)',
  controlIcon: '#3C3C43',
  link: '#2F95FF',
  accent: '#007AFF',
  success: '#34C759',
  errorSurface: 'rgba(255, 242, 240, 0.76)',
  errorTitle: '#5A2521',
  errorText: '#7B514D',
  errorIcon: '#C84B42',
  shadow: '#4A3F36',
} as const;

export const authDarkColors = {
  canvas: darkPalette.canvas,
  surface: darkPalette.glass,
  surfaceStrong: darkPalette.glassStrong,
  inputText: darkPalette.ink,
  title: darkPalette.ink,
  body: darkPalette.muted,
  placeholder: darkPalette.placeholder,
  label: darkPalette.muted,
  separator: darkPalette.border,
  glassBorder: darkPalette.border,
  glassHighlight: 'rgba(255, 255, 255, 0.22)',
  control: darkPalette.control,
  controlIcon: darkPalette.ink,
  link: darkPalette.accent,
  accent: darkPalette.accentStrong,
  success: darkPalette.success,
  errorSurface: 'rgba(87, 32, 29, 0.62)',
  errorTitle: '#FFD7D3',
  errorText: '#F1AAA4',
  errorIcon: darkPalette.danger,
  shadow: '#000000',
} as const;

export type AuthThemeColors = typeof authLightColors | typeof authDarkColors;

export function useAuthTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return { isDark, colors: isDark ? authDarkColors : authLightColors };
}

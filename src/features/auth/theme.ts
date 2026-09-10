import { useColorScheme } from 'react-native';

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
  accent: '#B65F3A',
  success: '#34C759',
  errorSurface: 'rgba(255, 242, 240, 0.76)',
  errorTitle: '#5A2521',
  errorText: '#7B514D',
  errorIcon: '#C84B42',
  shadow: '#4A3F36',
} as const;

export const authDarkColors = {
  canvas: '#000000',
  surface: 'rgba(38, 38, 40, 0.72)',
  surfaceStrong: 'rgba(48, 48, 50, 0.82)',
  inputText: '#F5F5F7',
  title: '#FFFFFF',
  body: '#A1A1A6',
  placeholder: 'rgba(235, 235, 245, 0.42)',
  label: '#A1A1A6',
  separator: 'rgba(235, 235, 245, 0.14)',
  glassBorder: 'rgba(255, 255, 255, 0.16)',
  glassHighlight: 'rgba(255, 255, 255, 0.22)',
  control: 'rgba(72, 72, 74, 0.62)',
  controlIcon: '#D1D1D6',
  link: '#409CFF',
  accent: '#C87550',
  success: '#30D158',
  errorSurface: 'rgba(87, 32, 29, 0.62)',
  errorTitle: '#FFD7D3',
  errorText: '#F1AAA4',
  errorIcon: '#FF6961',
  shadow: '#000000',
} as const;

export type AuthThemeColors = typeof authLightColors | typeof authDarkColors;

export function useAuthTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  return { isDark, colors: isDark ? authDarkColors : authLightColors };
}

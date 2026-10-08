import { useAppColorScheme as useColorScheme } from '@/theme/appearance';
import { darkPalette } from '@/theme/palette';
import { colors } from '@/theme/colors';

// Keep the current light glass treatment; dark navigation stays monochrome.
export const navigationLightColors = {
  canvas: colors.canvas,
  surface: '#FBFAF7',
  border: 'rgba(28, 28, 24, 0.10)',
  selectedSurface: '#E8E8EC',
  activeIcon: 'rgba(15, 15, 13, 0.98)',
  inactiveIcon: 'rgba(23, 23, 19, 0.72)',
} as const;

export const navigationDarkColors = {
  canvas: darkPalette.canvas,
  surface: darkPalette.surface,
  border: darkPalette.border,
  selectedSurface: darkPalette.control,
  activeIcon: darkPalette.ink,
  inactiveIcon: darkPalette.muted,
} as const;

export function useNavigationTheme() {
  const dark = useColorScheme() === 'dark';
  return { dark, ...(dark ? navigationDarkColors : navigationLightColors) };
}

// Media appearance only; geometry and animation come from the shared navigator.
export const momentsNavigationColors = {
  canvas: '#000000',
  surface: 'rgba(12,12,16,0.24)',
  border: 'rgba(255,255,255,0.16)',
  selectedSurface: 'rgba(255,255,255,0.12)',
  activeIcon: '#FFFFFF',
  inactiveIcon: 'rgba(255,255,255,0.72)',
} as const;

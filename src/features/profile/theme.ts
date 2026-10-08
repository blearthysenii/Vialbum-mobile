import { useAppColorScheme as useColorScheme } from '@/theme/appearance';
import { darkPalette } from '@/theme/palette';
import { useMemo } from 'react';

export function useProfileTheme() {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => ({
    dark,
    heroColors: dark ? ['#171F2B', '#263B50', '#1C1C1E'] as const : ['#344C66', '#718A9F', '#E8E3D8'] as const,
    groupedCanvas: dark ? darkPalette.canvas : '#F2F2F7',
    groupedSurface: dark ? darkPalette.surface : '#FFFFFF',
    canvas: dark ? darkPalette.canvas : '#FFFFFF',
    elevatedSurface: dark ? darkPalette.surface : '#F8F8F7',
    ink: dark ? darkPalette.ink : '#111111',
    muted: dark ? darkPalette.muted : '#777773',
    subtle: dark ? darkPalette.muted : '#9A9891',
    glass: dark ? darkPalette.glass : 'rgba(255,255,255,0.54)',
    glassStrong: dark ? darkPalette.glassStrong : 'rgba(248,248,248,0.78)',
    border: dark ? darkPalette.border : 'rgba(20,20,20,0.10)',
    divider: dark ? darkPalette.border : 'rgba(20,20,20,0.10)',
    placeholder: dark ? darkPalette.control : '#EEEDEA',
    accent: '#2F95FF',
    danger: '#FF453A',
  } as const), [dark]);
}

export type ProfileTheme = ReturnType<typeof useProfileTheme>;

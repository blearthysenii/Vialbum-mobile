import { useColorScheme } from 'react-native';

export function useProfileTheme() {
  const dark = useColorScheme() === 'dark';
  return {
    dark,
    canvas: dark ? '#000000' : '#FFFFFF',
    ink: dark ? '#F5F5F7' : '#111111',
    muted: dark ? '#A1A1A6' : '#777773',
    subtle: dark ? '#6E6E73' : '#9A9891',
    glass: dark ? 'rgba(38,38,40,0.58)' : 'rgba(255,255,255,0.54)',
    glassStrong: dark ? 'rgba(46,46,48,0.72)' : 'rgba(248,248,248,0.78)',
    border: dark ? 'rgba(255,255,255,0.14)' : 'rgba(20,20,20,0.10)',
    divider: dark ? 'rgba(255,255,255,0.12)' : 'rgba(20,20,20,0.10)',
    placeholder: dark ? '#343438' : '#EEEDEA',
    accent: '#2F95FF',
    danger: '#FF453A',
  } as const;
}

export type ProfileTheme = ReturnType<typeof useProfileTheme>;

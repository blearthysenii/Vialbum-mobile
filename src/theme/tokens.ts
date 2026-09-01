import type { TextStyle, ViewStyle } from 'react-native';

export const radii = { sm: 12, md: 16, lg: 22, xl: 28, round: 999 } as const;
export const controlHeights = { compact: 44, standard: 54, prominent: 58 } as const;

export const typography = {
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 1.8 } satisfies TextStyle,
  display: { fontSize: 42, lineHeight: 45, fontWeight: '800', letterSpacing: -1.8 } satisfies TextStyle,
  screenTitle: { fontSize: 34, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2 } satisfies TextStyle,
  sectionTitle: { fontSize: 24, lineHeight: 29, fontWeight: '800', letterSpacing: -0.7 } satisfies TextStyle,
  cardTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', letterSpacing: -0.4 } satisfies TextStyle,
  bodyLarge: { fontSize: 17, lineHeight: 25 } satisfies TextStyle,
  body: { fontSize: 15, lineHeight: 22 } satisfies TextStyle,
  metadata: { fontSize: 12, lineHeight: 17, fontWeight: '600' } satisfies TextStyle,
  button: { fontSize: 15, lineHeight: 20, fontWeight: '800' } satisfies TextStyle,
} as const;

export const shadows = {
  card: {
    shadowColor: '#171713', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14,
    shadowRadius: 18, elevation: 5,
  } satisfies ViewStyle,
  sheet: {
    shadowColor: '#171713', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18,
    shadowRadius: 20, elevation: 7,
  } satisfies ViewStyle,
} as const;

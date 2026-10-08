import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { presentationInterfaceStyle, useAppColorScheme } from './appearance';
import { darkPalette as p } from './palette';
export { presentationInterfaceStyle } from './appearance';
type Role = 'canvas' | 'surface' | 'control' | 'media' | 'content' | 'separator' | 'icon';
const colorProperties = new Set(['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'textDecorationColor', 'tintColor', 'placeholderTextColor', 'selectionColor', 'fill', 'stroke', 'shadowColor']);
export function presentationRole(name: string): Role {
  if (/chevron|closeLine|iconGlyph/i.test(name)) return 'icon';
  if (/divider|separator|baseline/i.test(name)) return 'separator';
  if (/backdrop|preview|player|photo|video|scrim|media/i.test(name)) return 'media';
  if (/input|field|button|selected|control|chip|pill|contained|skeleton|placeholder|secondary|primary|indicator|active|selection/i.test(name)) return 'control';
  if (/card|sheet|menu|dialog|panel|well|result|cell|row|option|surface|bubble|elevated|segment|tabs/i.test(name)) return 'surface';
  if (/screen|safe|root|canvas|scroll|container|content|form/i.test(name)) return 'canvas';
  return 'content';
}
function rgb(value: string) {
  value = ({ white: '#FFFFFF', black: '#000000', gray: '#808080', grey: '#808080' } as Record<string, string>)[value] ?? value;
  const hex = value.replace('#', '');
  if (/^#[0-9a-f]{3}$/i.test(value)) return [...hex].map(c => parseInt(c + c, 16));
  if (/^#[0-9a-f]{6}$/i.test(value)) return [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16));
  const match = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  return match ? match.slice(1, 4).map(Number) : null;
}
// Compatibility adapter for existing presentation colors: light passes through
// byte-for-byte; semantic role chooses the approved dark token. This keeps old
// geometry/style records intact while screens migrate to named feature tokens.
export function resolvePresentationColor(value: unknown, property = 'color', role: Role = 'content', dark = presentationInterfaceStyle() === 'dark'): any {
  if (dark && Array.isArray(value)) return value.map(color => resolvePresentationColor(color, property, role, dark));
  if (dark && typeof value === 'string' && ['#007AFF', '#2F95FF'].includes(value.toUpperCase())) {
    if (property === 'backgroundColor' && role === 'control') return p.accentFill;
    if (value.toUpperCase() === '#007AFF' && property !== 'backgroundColor') return p.accent;
  }
  if (dark && value === p.canvas && property === 'backgroundColor') return role === 'surface' ? p.surface : role === 'control' ? p.control : p.canvas;
  if (dark && Object.entries(p).some(([key, token]) => !['onMedia', 'media', 'shadow'].includes(key) && token === value)) return value;
  if (!dark || typeof value !== 'string' || value === 'transparent') return value;
  if (property === 'backgroundColor' && ['#F5E9E4', '#FFF0F1'].includes(value.toUpperCase())) return p.errorSurface;
  if (property === 'shadowColor') return p.shadow;
  if (/A33D2D|C84B42|FF453A|D94|EF4444|DC2626/i.test(value)) return p.danger;
  if (/526B50|34C759|30D158/i.test(value)) return p.success;
  const channels = rgb(value); if (!channels) return value;
  const high = Math.max(...channels), low = Math.min(...channels);
  // Intentional brand, status, map marker and route hues are preserved.
  if (high - low > 42) return value;
  if (/border|stroke/i.test(property)) return role === 'icon' ? p.ink : p.border;
  if (property === 'backgroundColor' || property === 'colors') {
    if (role === 'icon') return p.ink;
    if (role === 'separator') return p.border;
    if (high < 12 || role === 'media' && high < 100) return value;
    const base = role === 'control' ? p.control : role === 'surface' ? p.surface : p.canvas;
    const alpha = value.match(/^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/i);
    if (alpha) { const parts = rgb(base)!; return `rgba(${parts.join(',')},${alpha[1]})`; }
    return base;
  }
  if (property === 'placeholderTextColor') return p.placeholder;
  // White controls/text over photos, video, glass and brand buttons remain white.
  if (low > 240) return value;
  return high < 90 ? p.ink : p.muted;
}
export function presentationBlurTint<T extends string>(value: T): T {
  if (presentationInterfaceStyle() !== 'dark') return value;
  return (value === 'light' ? 'dark' : value.replace(/Light$/, 'Dark')) as T;
}
const canvasStyles = new WeakMap<object, Record<string, any>>();
const sheetStyles = new WeakMap<object, Record<string, any>>();
export function usePresentationStyles<T extends Record<string, any>>(baseline: T, canvasRole: 'canvas' | 'surface' = 'canvas'): T {
  const dark = useAppColorScheme() === 'dark';
  return useMemo(() => {
    if (!dark) return baseline;
    const cache = canvasRole === 'surface' ? sheetStyles : canvasStyles;
    const cached = cache.get(baseline);
    if (cached) return cached as T;
    const result: Record<string, any> = {};
    for (const [name, raw] of Object.entries(baseline)) {
      const style = { ...StyleSheet.flatten(raw) };
      const role = presentationRole(name);
      for (const property of Object.keys(style)) if (colorProperties.has(property)) style[property] = resolvePresentationColor(style[property], property, role === 'canvas' ? canvasRole : role, true);
      result[name] = style;
    }
    cache.set(baseline, result);
    return result as T;
  }, [baseline, dark, canvasRole]);
}

const darkTextStyle = { color: p.ink } as const;
// iOS React Native defaults uncolored Text to black, even in a dark window.
// Explicit colors and nested Text inheritance continue to take precedence.
export function presentationTextStyle(style?: any): any {
  if (presentationInterfaceStyle() !== 'dark' || StyleSheet.flatten(style)?.color != null) return style;
  return style == null ? darkTextStyle : [darkTextStyle, style];
}

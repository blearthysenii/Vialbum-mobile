import { useEffect, useRef, type ComponentRef } from 'react';
import type { Marker } from 'react-native-maps';
import { useAppColorScheme } from './appearance';

// Custom map markers are native snapshots when tracking is disabled. Refresh
// that snapshot on appearance changes without replacing the marker or media.
export function useThemedMarker() {
  const ref = useRef<ComponentRef<typeof Marker>>(null);
  const scheme = useAppColorScheme();
  useEffect(() => {
    const frame = requestAnimationFrame(() => ref.current?.redraw());
    return () => cancelAnimationFrame(frame);
  }, [scheme]);
  return ref;
}

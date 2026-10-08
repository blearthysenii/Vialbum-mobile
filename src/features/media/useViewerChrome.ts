import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';

export function useViewerChrome() {
  const [visible, setVisible] = useState(true);
  const opacity = useSharedValue(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const screenReader = useRef(false);
  const interacting = useRef(false);
  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const reveal = useCallback(() => {
    clear(); setVisible(true); opacity.set(withTiming(1, { duration: 140 }));
    if (!screenReader.current && !interacting.current) timer.current = setTimeout(() => {
      setVisible(false); opacity.set(withTiming(0, { duration: 220 }));
    }, 2200);
  }, [clear, opacity]);
  const interaction = useCallback((active: boolean) => { interacting.current = active; reveal(); }, [reveal]);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then(enabled => { if (mounted) { screenReader.current = enabled; reveal(); } });
    const subscription = AccessibilityInfo.addEventListener('screenReaderChanged', enabled => { screenReader.current = enabled; reveal(); });
    reveal();
    return () => { mounted = false; subscription.remove(); clear(); };
  }, [clear, reveal]);
  return { visible, opacity, reveal, interaction };
}

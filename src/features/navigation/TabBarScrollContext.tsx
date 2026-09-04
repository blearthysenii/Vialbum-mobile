import { createContext, type ReactNode, useCallback, useContext, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

type TabBarScrollContextValue = {
  collapsed: boolean;
  expand: () => void;
  setCollapsed: (collapsed: boolean) => void;
};

const TabBarScrollContext = createContext<TabBarScrollContextValue>({
  collapsed: false,
  expand: () => undefined,
  setCollapsed: () => undefined,
});

export function TabBarScrollProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const expand = useCallback(() => setCollapsed(false), []);

  return (
    <TabBarScrollContext.Provider value={{ collapsed, expand, setCollapsed }}>
      {children}
    </TabBarScrollContext.Provider>
  );
}

export function useTabBarController() {
  return useContext(TabBarScrollContext);
}

export function useTabBarScroll() {
  const { setCollapsed } = useTabBarController();
  const previousOffset = useRef(0);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
      const canScroll = contentSize.height > layoutMeasurement.height + 1;

      if (!canScroll) {
        previousOffset.current = 0;
        setCollapsed(false);
        return;
      }

      const maximumOffset = Math.max(
        0,
        contentSize.height - layoutMeasurement.height,
      );
      const offset = Math.min(
        maximumOffset,
        Math.max(0, contentOffset.y),
      );
      const delta = offset - previousOffset.current;

      if (offset <= 0.5) {
        setCollapsed(false);
      } else if (delta > 0.1) {
        setCollapsed(true);
      } else if (delta < -0.1) {
        setCollapsed(false);
      }

      previousOffset.current = offset;
    },
    [setCollapsed],
  );

  return { onScroll, scrollEventThrottle: 16 as const };
}

import { usePresentationStyles, resolvePresentationColor } from '@/theme/presentation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { NavigationGlass, useNavigationEnvironment } from '@/features/navigation/NavigationGlass';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  AppState,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type LayoutRectangle,
  View,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Reanimated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { momentsNavigationColors, useNavigationTheme } from '@/features/navigation/theme';
import { navigationBottom, NAVIGATION_HEIGHT } from '@/features/navigation/geometry';

import {
  TabBarScrollProvider,
  useTabBarController,
} from '@/features/navigation/TabBarScrollContext';

type IconName = ComponentProps<
  typeof Ionicons
>['name'];

type BottomTabBarProps = Parameters<
  NonNullable<
    ComponentProps<typeof Tabs>['tabBar']
  >
>[0];

type TabName =
  | 'index'
  | 'search'
  | 'map'
  | 'profile';

type TabConfig = {
  accessibilityLabel: string;
  activeIcon: IconName;
  inactiveIcon: IconName;
};

const tabs: Record<TabName, TabConfig> = {
  index: {
    accessibilityLabel: 'Home, journeys',
    activeIcon: 'home',
    inactiveIcon: 'home-outline',
  },

  search: {
    accessibilityLabel: 'Moments, windows into places',
    activeIcon: 'play-circle',
    inactiveIcon: 'play-circle-outline',
  },

  map: {
    accessibilityLabel: 'Map and places',
    activeIcon: 'map',
    inactiveIcon: 'map-outline',
  },

  profile: {
    accessibilityLabel: 'Profile and settings',
    activeIcon: 'person',
    inactiveIcon: 'person-outline',
  },
};

function isTabName(
  name: string,
): name is TabName {
  return name in tabs;
}

type TabButtonProps = {
  tab: TabConfig;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onNavbarIconPressIn: () => void;
  onNavbarIconPressOut: () => void;
  testID?: string;
  iconColor: string;
  disabled: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
};

// Equal inset on each side gives a wide capsule while preserving slot centers.
const INDICATOR_INSET = 6;
const AnimatedGesturePressable = Reanimated.createAnimatedComponent(Pressable);

function TabButton({
  tab, focused, disabled, onPress, onLongPress, onNavbarIconPressIn,
  onNavbarIconPressOut, testID, iconColor, onLayout,
}: TabButtonProps) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  return (
    <Pressable
      accessibilityLabel={tab.accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused, disabled }}
      disabled={disabled}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={onNavbarIconPressIn}
      onPressOut={onNavbarIconPressOut}
      onLayout={onLayout}
      style={styles.segment}
      testID={testID}
    >
      <View style={styles.iconFrame}>
        <Ionicons
          color={resolvePresentationColor(iconColor, 'color', 'content')}
          name={focused ? tab.activeIcon : tab.inactiveIcon}
          size={26}
          style={styles.iconGlyph}
        />
      </View>
    </Pressable>
  );
}

function VialbumTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const baseTheme = useNavigationTheme();
  const momentsOverlay = state.routes[state.index]?.name === 'search';
  const theme = momentsOverlay ? { ...momentsNavigationColors, dark: true } : baseTheme;
  const insets =
    useSafeAreaInsets();

  const {
    collapsed,
    expand,
    interactionLocked,
    isInteractionLocked,
  } = useTabBarController();

  const reduceMotion = useReducedMotion();
  const { reduceTransparency, keyboardVisible } = useNavigationEnvironment();
  const [capsuleWidth, setCapsuleWidth] = useState(0);
  const [slotLayouts, setSlotLayouts] = useState<Record<string, LayoutRectangle>>({});

  const navbarPressProgress =
    useRef(
      new Animated.Value(0),
    ).current;

  const navbarPressBrightness =
    useRef(
      new Animated.Value(0),
    ).current;

  const navbarPressStartedAt =
    useRef(0);

  const navbarPressStartedCollapsed =
    useRef(false);

  const navbarTouchMode =
    useRef<
      'background' | 'icon' | null
    >(null);

  const navbarReleaseTimer =
    useRef<
      ReturnType<typeof setTimeout> | null
    >(null);

  const clearNavbarReleaseTimer =
    useCallback(() => {
      if (
        navbarReleaseTimer.current
      ) {
        clearTimeout(
          navbarReleaseTimer.current,
        );
        navbarReleaseTimer.current =
          null;
      }
    }, []);

  const showNavbarBrightness =
    useCallback(() => {
      if (reduceMotion) { navbarPressBrightness.setValue(1); return; }
      Animated.timing(
        navbarPressBrightness,
        {
          toValue: 1,
          duration: 35,
          useNativeDriver: true,
        },
      ).start();
    }, [
      navbarPressBrightness, reduceMotion,
    ]);

  const hideNavbarBrightness =
    useCallback(() => {
      if (reduceMotion) { navbarPressBrightness.setValue(0); return; }
      Animated.timing(
        navbarPressBrightness,
        {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        },
      ).start();
    }, [
      navbarPressBrightness, reduceMotion,
    ]);

  const springNavbarPress =
    useCallback(
      (toValue: number) => {
        if (reduceMotion) { navbarPressProgress.setValue(0); return; }
        Animated.spring(
          navbarPressProgress,
          {
            toValue,
            damping: 20,
            stiffness: 280,
            mass: 0.62,
            useNativeDriver: true,
          },
        ).start();
      },
      [
        navbarPressProgress, reduceMotion,
      ],
    );

  const releaseNavbarPress =
    useCallback(() => {
      if (reduceMotion) { navbarPressProgress.setValue(0); return; }
      Animated.spring(
        navbarPressProgress,
        {
          toValue: 0,
          damping: 19,
          stiffness: 250,
          mass: 0.68,
          useNativeDriver: true,
        },
      ).start();
    }, [
      navbarPressProgress, reduceMotion,
    ]);

  const finishBrightnessAfterMinimumTap =
    useCallback(() => {
      const elapsed =
        Date.now() -
        navbarPressStartedAt.current;

      const remaining =
        Math.max(
          0,
          150 - elapsed,
        );

      const finish = () => {
        hideNavbarBrightness();

        navbarTouchMode.current =
          null;

        navbarPressStartedCollapsed.current =
          false;

        navbarReleaseTimer.current =
          null;
      };

      if (remaining > 0) {
        clearNavbarReleaseTimer();

        navbarReleaseTimer.current =
          setTimeout(
            finish,
            remaining,
          );

        return;
      }

      finish();
    }, [
      clearNavbarReleaseTimer,
      hideNavbarBrightness,
    ]);

  const handleNavbarBackgroundPressIn =
    useCallback(() => {
      clearNavbarReleaseTimer();

      navbarTouchMode.current =
        'background';

      navbarPressStartedAt.current =
        Date.now();

      navbarPressStartedCollapsed.current =
        collapsed;

      showNavbarBrightness();

      springNavbarPress(
        collapsed ? 0.22 : 1,
      );
    }, [
      clearNavbarReleaseTimer,
      collapsed,
      showNavbarBrightness,
      springNavbarPress,
    ]);

  const handleNavbarBackgroundPressOut =
    useCallback(() => {
      if (
        navbarTouchMode.current ===
        'icon'
      ) {
        return;
      }

      const startedCollapsed =
        navbarPressStartedCollapsed.current;

      releaseNavbarPress();

      if (startedCollapsed) {
        expand();
      }

      finishBrightnessAfterMinimumTap();
    }, [
      expand,
      finishBrightnessAfterMinimumTap,
      releaseNavbarPress,
    ]);

  const handleNavbarIconPressIn =
    useCallback(() => {
      clearNavbarReleaseTimer();

      const startedCollapsed =
        collapsed;

      navbarTouchMode.current =
        'icon';

      navbarPressStartedAt.current =
        Date.now();

      navbarPressStartedCollapsed.current =
        startedCollapsed;

      showNavbarBrightness();

      springNavbarPress(
        startedCollapsed ? 0.22 : 1,
      );
    }, [
      clearNavbarReleaseTimer,
      collapsed,
      showNavbarBrightness,
      springNavbarPress,
    ]);

  const handleNavbarIconPressOut =
    useCallback(() => {
      const startedCollapsed =
        navbarPressStartedCollapsed.current;

      releaseNavbarPress();

      if (startedCollapsed) {
        expand();
      }

      finishBrightnessAfterMinimumTap();
    }, [
      expand,
      finishBrightnessAfterMinimumTap,
      releaseNavbarPress,
    ]);

  useEffect(() => () => {
    if (navbarReleaseTimer.current) clearTimeout(navbarReleaseTimer.current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') return;
      clearNavbarReleaseTimer();
      navbarPressProgress.stopAnimation();
      navbarPressBrightness.stopAnimation();
      navbarPressProgress.setValue(0);
      navbarPressBrightness.setValue(0);
      navbarTouchMode.current = null;
      navbarPressStartedCollapsed.current = false;
    });
    return () => subscription.remove();
  }, [clearNavbarReleaseTimer, navbarPressBrightness, navbarPressProgress]);

  const measureSlot = useCallback((key: string, layout: LayoutRectangle) => {
    setSlotLayouts(previous => {
      const existing = previous[key];
      if (existing && existing.x === layout.x && existing.y === layout.y &&
          existing.width === layout.width && existing.height === layout.height) return previous;
      return { ...previous, [key]: layout };
    });
  }, []);

  // Yoga lays out four equal flex slots. Use their actual measured centers,
  // including native pixel rounding, rather than estimating from screen width.
  const slotCenters = useMemo(() => state.routes.map(route => {
    const layout = slotLayouts[route.key];
    return layout ? { x: layout.x + layout.width / 2, y: layout.y + layout.height / 2 } : null;
  }), [slotLayouts, state.routes]);
  // Share one size across every tab, including native fractional-pixel rounding.
  // The 62-point navigator leaves 6 points above/below the 50-point capsule.
  const measuredSlots = state.routes.map(route => slotLayouts[route.key]);
  const indicatorWidth = measuredSlots.every(Boolean)
    ? Math.max(0, Math.min(...measuredSlots.map(slot => slot.width)) - INDICATOR_INSET * 2) : 0;
  const indicatorHeight = measuredSlots.every(Boolean)
    ? Math.max(0, Math.min(...measuredSlots.map(slot => slot.height)) - INDICATOR_INSET * 2) : 0;
  const activeCenter = slotCenters[state.index];
  const measuredCenters = slotCenters.map(center => center?.x ?? 0);
  const slotsReady = slotCenters.length > 0 && slotCenters.every(center => center !== null);

  const activePosition = useSharedValue(0);
  const activeCenterY = useSharedValue(0);
  const indicatorVisible = useSharedValue(0);
  const dragStartPosition = useSharedValue(0);
  const previousIndex = useRef(state.index);
  const collapseProgress = useRef(new Animated.Value(collapsed ? 1 : 0)).current;

  const settleIndicator = useCallback((index: number) => {
    const center = slotCenters[index];
    if (!center) return;
    activePosition.set(reduceMotion ? center.x : withSpring(center.x, {
      damping: 23, stiffness: 250, mass: 0.72, overshootClamping: true,
    }));
    activeCenterY.set(center.y);
  }, [activeCenterY, activePosition, reduceMotion, slotCenters]);

  const snapToIndex = useCallback((index: number) => {
    if (isInteractionLocked()) { settleIndicator(state.index); return; }
    const route = state.routes[index];
    if (!route || !isTabName(route.name) || index === state.index) {
      settleIndicator(state.index);
      return;
    }
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) {
      settleIndicator(state.index);
      return;
    }
    settleIndicator(index);
    navigation.navigate(route.name, route.params);
  }, [isInteractionLocked, navigation, settleIndicator, state.index, state.routes]);

  const activeAnimatedStyle = useAnimatedStyle(() => ({
    opacity: indicatorVisible.get(),
    width: indicatorWidth,
    height: indicatorHeight,
    borderRadius: indicatorHeight / 2,
    transform: [
      { translateX: activePosition.get() - indicatorWidth / 2 },
      { translateY: activeCenterY.get() - indicatorHeight / 2 },
    ],
  }));

  const activePanGesture = Gesture.Pan()
    .enabled(slotsReady && !interactionLocked)
    .activateAfterLongPress(80)
    .activeOffsetX([-2, 2])
    .failOffsetY([-18, 18])
    .onBegin(() => { dragStartPosition.set(activePosition.get()); })
    .onStart(() => {
      dragStartPosition.set(activePosition.get());
      if (!collapsed) runOnJS(expand)();
    })
    .onUpdate(event => {
      activePosition.set(Math.max(Math.min(...measuredCenters), Math.min(
        Math.max(...measuredCenters),
        dragStartPosition.get() + event.translationX,
      )));
    })
    .onEnd(event => {
      const projectedCenter = activePosition.get() + event.velocityX * 0.045;
      let nearestIndex = 0;
      for (let index = 1; index < measuredCenters.length; index++) {
        if (Math.abs(measuredCenters[index] - projectedCenter) <
            Math.abs(measuredCenters[nearestIndex] - projectedCenter)) nearestIndex = index;
      }
      runOnJS(snapToIndex)(nearestIndex);
    })
    .onFinalize((_, success) => {
      if (!success) runOnJS(settleIndicator)(state.index);
    });

  useEffect(() => {
    if (reduceMotion) { collapseProgress.setValue(collapsed ? 1 : 0); return; }
    Animated.spring(
      collapseProgress,
      {
        toValue:
          collapsed ? 1 : 0,
        damping: 22,
        stiffness: 260,
        mass: 0.72,
        useNativeDriver: true,
      },
    ).start();
  }, [
    collapseProgress,
    collapsed, reduceMotion,
  ]);

  useEffect(() => {
    if (!collapsed) {
      expand();
    }
  }, [
    collapsed,
    expand,
    state.index,
  ]);

  useLayoutEffect(() => {
    if (!activeCenter || !slotsReady) return;
    const changed = previousIndex.current !== state.index;
    previousIndex.current = state.index;
    activePosition.set(changed && !reduceMotion ? withSpring(activeCenter.x, {
      damping: 23, stiffness: 250, mass: 0.72, overshootClamping: true,
    }) : activeCenter.x);
    activeCenterY.set(activeCenter.y);
    indicatorVisible.set(1);
  }, [activeCenter, activeCenterY, activePosition, indicatorVisible, reduceMotion, slotsReady, state.index]);

  return (
    <Animated.View
      pointerEvents={interactionLocked || keyboardVisible ? 'none' : 'box-none'}
      accessibilityElementsHidden={keyboardVisible}
      importantForAccessibility={keyboardVisible ? 'no-hide-descendants' : 'auto'}
      onTouchStart={
        handleNavbarBackgroundPressIn
      }
      onTouchEnd={
        handleNavbarBackgroundPressOut
      }
      onTouchCancel={
        handleNavbarBackgroundPressOut
      }
      style={[
        styles.shell,
        { shadowOpacity: reduceTransparency ? .04 : .06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2, display: keyboardVisible ? 'none' : 'flex' },
        {
          bottom: navigationBottom(insets.bottom),
        },
        {
          transform: [
            {
              scaleX:
                collapseProgress.interpolate(
                  {
                    inputRange: [
                      0,
                      1,
                    ],
                    outputRange: [
                      1,
                      0.88,
                    ],
                  },
                ),
            },

            {
              scaleY:
                collapseProgress.interpolate(
                  {
                    inputRange: [
                      0,
                      1,
                    ],
                    outputRange: [
                      1,
                      0.82,
                    ],
                  },
                ),
            },

            {
              translateY:
                collapseProgress.interpolate(
                  {
                    inputRange: [
                      0,
                      1,
                    ],
                    outputRange: [
                      0,
                      5,
                    ],
                  },
                ),
            },

          ],
        },
      ]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        transform: [
          { scaleX: navbarPressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, capsuleWidth > 0 ? (capsuleWidth + 6) / capsuleWidth : 1] }) },
          { scaleY: navbarPressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
        ],
      }]}>
        <NavigationGlass dark={theme.dark} radius={NAVIGATION_HEIGHT / 2} reduceTransparency={reduceTransparency} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: NAVIGATION_HEIGHT / 2,
          backgroundColor: theme.dark ? 'rgba(245,245,247,0.035)' : 'rgba(255,255,255,0.10)', opacity: navbarPressBrightness }]} />
      </Animated.View>

      <View
        accessibilityRole="tablist"
        onLayout={event => setCapsuleWidth(event.nativeEvent.layout.width)}
        style={styles.contentBar}
      >

        <Reanimated.View
          pointerEvents="none"
          style={[styles.activeIndicator, { overflow: 'hidden' }, activeAnimatedStyle]}
        >
          <NavigationGlass dark={theme.dark} selected radius={indicatorHeight / 2} reduceTransparency={reduceTransparency} />
        </Reanimated.View>

        {state.routes.map(
          (
            route,
            index,
          ) => {
            if (
              !isTabName(
                route.name,
              )
            ) {
              return null;
            }

            const focused =
              state.index ===
              index;

            const tab =
              tabs[
                route.name
              ];

            const options =
              descriptors[
                route.key
              ].options;

            const onPress =
              () => {
                if (isInteractionLocked()) return;
                if (!collapsed) {
                  expand();
                }

                const event =
                  navigation.emit(
                    {
                      type: 'tabPress',
                      target:
                        route.key,
                      canPreventDefault:
                        true,
                    },
                  );

                if (
                  !focused &&
                  !event.defaultPrevented
                ) {
                  void Haptics.selectionAsync().catch(() => undefined);
                  navigation.navigate(
                    route.name,
                    route.params,
                  );
                }
              };

            const onLongPress =
              () => {
                if (isInteractionLocked()) return;
                navigation.emit(
                  {
                    type: 'tabLongPress',
                    target:
                      route.key,
                  },
                );
              };

            return (
              <TabButton
                focused={
                  focused
                }
                key={
                  route.key
                }
                onLongPress={
                  onLongPress
                }
                onPress={
                  onPress
                }
                onNavbarIconPressIn={
                  handleNavbarIconPressIn
                }
                onNavbarIconPressOut={
                  handleNavbarIconPressOut
                }
                disabled={interactionLocked || keyboardVisible}
                iconColor={focused ? theme.activeIcon : theme.inactiveIcon}
                tab={tab}
                onLayout={event => measureSlot(route.key, event.nativeEvent.layout)}
                testID={
                  options.tabBarButtonTestID
                }
              />
            );
          },
        )}

        <GestureDetector gesture={activePanGesture}>
          <AnimatedGesturePressable
            hitSlop={6}
            onLongPress={() => {
              if (isInteractionLocked()) return;
              navigation.emit({ type: 'tabLongPress', target: state.routes[state.index].key });
            }}
            onPress={() => {
              if (isInteractionLocked()) return;
              const route = state.routes[state.index];
              navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            }}
            accessibilityElementsHidden importantForAccessibility="no-hide-descendants" accessible={false}
            accessibilityLabel="Drag to switch tabs"
            accessibilityRole="adjustable"
            pointerEvents={slotsReady ? 'auto' : 'none'}
            style={[styles.indicatorGestureArea, activeAnimatedStyle]}
          />
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useNavigationTheme();
  return (
    <GestureHandlerRootView
      style={[styles.root, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}
    >
      <TabBarScrollProvider>
        <Tabs
          tabBar={(props) => (
            <VialbumTabBar
              {...props}
            />
          )}
          screenOptions={{
            sceneStyle: { backgroundColor: theme.canvas },
            headerShown:
              false,
            tabBarHideOnKeyboard:
              true,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
            }}
          />

          <Tabs.Screen
            name="search"
            options={{
              title: 'Moments',
            }}
          />

          <Tabs.Screen
            name="map"
            options={{
              title: 'Map',
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
            }}
          />
        </Tabs>
      </TabBarScrollProvider>
    </GestureHandlerRootView>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
    },

    momentsHighlight: { ...StyleSheet.absoluteFill, borderTopWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.2)', borderRadius: 31 },
    momentsIndicator: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.12)' },
    momentsSelectedTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.14)' },
    darkShell: {
      borderRadius: 999,
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },

    darkCapsule: {
      borderRadius: 999,
    },

    shell: {
      borderCurve:
        'continuous',

      borderRadius: 31,

      elevation: 5,

      left: 20,

      position:
        'absolute',

      right: 20,

      shadowColor:
        '#000000',

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity:
        0.15,

      shadowRadius: 18,

      zIndex: 20,
    },

    animatedBackground: {
      height: NAVIGATION_HEIGHT,

      position:
        'absolute',
    },

    backgroundBar: {
      backgroundColor:
        'rgba(255, 255, 255, 0.06)',

      borderColor:
        'rgba(28, 28, 24, 0.10)',

      borderCurve:
        'continuous',

      borderRadius: 31,

      borderWidth:
        StyleSheet.hairlineWidth,

      height: '100%',

      overflow:
        'hidden',

      width: '100%',
    },

    contentBar: {
      zIndex: 2,
      alignItems:
        'center',

      borderCurve:
        'continuous',

      borderRadius: 31,

      flexDirection:
        'row',

      height: NAVIGATION_HEIGHT,

      overflow:
        'visible',

      width: '100%',
    },

    surfaceTint: {
      position:
        'absolute',

      inset: 0,

      backgroundColor:
        'rgba(255, 255, 255, 0.028)',
    },

    navbarPressLightOverlay: {
      borderCurve:
        'continuous',

      borderRadius: 31,

      overflow: 'hidden',

      position: 'absolute',

      zIndex: 1,
    },

    bottomShade: {
      backgroundColor:
        'rgba(0, 0, 0, 0.007)',

      bottom: 0,

      height: 13,

      left: 0,

      position:
        'absolute',

      right: 0,
    },

    glassHighlight: {
      position:
        'absolute',

      inset: 1,

      borderColor:
        'rgba(255, 255, 255, 0.38)',

      borderCurve:
        'continuous',

      borderRadius: 30,

      borderWidth:
        StyleSheet.hairlineWidth,
    },

    activeIndicator: {
      position: 'absolute',
      left: 0,
      top: 0,
      borderCurve: 'continuous',
      zIndex: 2,
    },

    indicatorGestureArea: {
      position: 'absolute',
      left: 0,
      top: 0,
      zIndex: 20,
    },

    iconFrame: {
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },

    iconGlyph: {
      width: 26,
      height: 26,
      lineHeight: 26,
      textAlign: 'center',
      includeFontPadding: false,
    },

    segment: {
      alignItems:
        'center',

      alignSelf:
        'stretch',

      flex: 1,

      justifyContent:
        'center',

      flexBasis: 0,
      minWidth: 0,

      zIndex: 4,
    },
  });
const presentationBaselineStyles = styles;

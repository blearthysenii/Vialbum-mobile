import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
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
  | 'create'
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
    accessibilityLabel: 'Search',
    activeIcon: 'search',
    inactiveIcon: 'search-outline',
  },

  create: {
    accessibilityLabel: 'Create a new journey',
    activeIcon: 'add-outline',
    inactiveIcon: 'add-outline',
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
  tabName: TabName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onNavbarIconPressIn: () => void;
  onNavbarIconPressOut: () => void;
  testID?: string;
};

function TabButton({
  tab,
  tabName,
  focused,
  onPress,
  onLongPress,
  onNavbarIconPressIn,
  onNavbarIconPressOut,
  testID,
}: TabButtonProps) {
  const reduceMotion = useReducedMotion();
  const iconScale = useRef(
    new Animated.Value(
      focused ? 1 : 0.96,
    ),
  ).current;

  useEffect(() => {
    if (reduceMotion) {
      iconScale.setValue(focused ? 1 : 0.96);
      return;
    }
    if (focused) {
      Animated.sequence([
        Animated.timing(iconScale, { toValue: 1.08, duration: 90, useNativeDriver: true }),
        Animated.spring(iconScale, { toValue: 1, damping: 20, stiffness: 300, mass: 0.62, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.spring(iconScale, { toValue: 0.96, damping: 18, stiffness: 260, mass: 0.7, useNativeDriver: true }).start();
    }
  }, [focused, iconScale, reduceMotion]);

  const horizontalOffset =
    tabName === 'index'
      ? 7
      : tabName === 'profile'
        ? -7
        : 0;

  return (
    <Pressable
      accessibilityLabel={
        tab.accessibilityLabel
      }
      accessibilityRole="tab"
      accessibilityState={{
        selected: focused,
      }}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={
        onNavbarIconPressIn
      }
      onPressOut={
        onNavbarIconPressOut
      }
      style={styles.segment}
      testID={testID}
    >
      <Animated.View
        style={{
          transform: [
            {
              translateX:
                horizontalOffset,
            },
            {
              scale: iconScale,
            },
          ],
        }}
      >
        <Ionicons
          color={
            focused
              ? 'rgba(15, 15, 13, 0.98)'
              : 'rgba(23, 23, 19, 0.72)'
          }
          name={
            focused
              ? tab.activeIcon
              : tab.inactiveIcon
          }
          size={26}
        />
      </Animated.View>
    </Pressable>
  );
}

function VialbumTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets =
    useSafeAreaInsets();

  const {
    collapsed,
    expand,
  } = useTabBarController();

  const {
    width: screenWidth,
  } = useWindowDimensions();

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
      Animated.timing(
        navbarPressBrightness,
        {
          toValue: 1,
          duration: 35,
          useNativeDriver: false,
        },
      ).start();
    }, [
      navbarPressBrightness,
    ]);

  const hideNavbarBrightness =
    useCallback(() => {
      Animated.timing(
        navbarPressBrightness,
        {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        },
      ).start();
    }, [
      navbarPressBrightness,
    ]);

  const springNavbarPress =
    useCallback(
      (toValue: number) => {
        Animated.spring(
          navbarPressProgress,
          {
            toValue,
            damping: 20,
            stiffness: 280,
            mass: 0.62,
            useNativeDriver: false,
          },
        ).start();
      },
      [
        navbarPressProgress,
      ],
    );

  const releaseNavbarPress =
    useCallback(() => {
      Animated.spring(
        navbarPressProgress,
        {
          toValue: 0,
          damping: 19,
          stiffness: 250,
          mass: 0.68,
          useNativeDriver: false,
        },
      ).start();
    }, [
      navbarPressProgress,
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

  const capsuleWidth =
    screenWidth - 40;

  useEffect(() => {
    return () => {
      if (
        navbarReleaseTimer.current
      ) {
        clearTimeout(
          navbarReleaseTimer.current,
        );
      }
    };
  }, []);

  const tabCount =
    state.routes.length;

  const segmentWidth =
    capsuleWidth / tabCount;

  const edgeInset = 7;

  const activeWidth =
    segmentWidth - edgeInset * 2 + 14;

  const getPositionForIndex =
    useCallback(
      (index: number) => {
        const boundedIndex =
          Math.max(
            0,
            Math.min(
              tabCount - 1,
              index,
            ),
          );

        const center =
          boundedIndex *
            segmentWidth +
          segmentWidth / 2;

        return Math.max(
          edgeInset,
          Math.min(
            capsuleWidth -
              activeWidth -
              edgeInset,
            center -
              activeWidth / 2,
          ),
        );
      },
      [
        activeWidth,
        capsuleWidth,
        edgeInset,
        segmentWidth,
        tabCount,
      ],
    );

  const activeOffset =
    getPositionForIndex(
      state.index,
    );

  const activePosition =
    useSharedValue(
      activeOffset,
    );

  const dragStartPosition =
    useSharedValue(
      activeOffset,
    );

  const isDragging =
    useSharedValue(false);

  const activeScaleX =
    useRef(
      new Animated.Value(1),
    ).current;

  const activeScaleY =
    useRef(
      new Animated.Value(1),
    ).current;

  const previousIndex =
    useRef(state.index);

  const collapseProgress =
    useRef(
      new Animated.Value(
        collapsed ? 1 : 0,
      ),
    ).current;

  const snapToIndex =
    useCallback(
      (index: number) => {
        const boundedIndex =
          Math.max(
            0,
            Math.min(
              tabCount - 1,
              index,
            ),
          );

        const targetPosition =
          getPositionForIndex(
            boundedIndex,
          );

        activePosition.set(
          withSpring(
            targetPosition,
            {
              damping: 22,
              stiffness: 280,
              mass: 0.68,
            },
          ),
        );

        const route =
          state.routes[
            boundedIndex
          ];

        if (
          !route ||
          !isTabName(
            route.name,
          )
        ) {
          return;
        }

        if (
          boundedIndex ===
          state.index
        ) {
          return;
        }

        const event =
          navigation.emit({
            type: 'tabPress',
            target:
              route.key,
            canPreventDefault:
              true,
          });

        if (
          !event.defaultPrevented
        ) {
          navigation.navigate(
            route.name,
            route.params,
          );
        }
      },
      [
        activePosition,
        getPositionForIndex,
        navigation,
        state.index,
        state.routes,
        tabCount,
      ],
    );

  const activeAnimatedStyle =
    useAnimatedStyle(
      () => ({
        transform: [
          {
            translateX:
              activePosition.get(),
          },
        ],
      }),
    );

  const activePanGesture =
    Gesture.Pan()
      .activateAfterLongPress(
        80,
      )
      .activeOffsetX([
        -2,
        2,
      ])
      .failOffsetY([
        -18,
        18,
      ])
      .onBegin(() => {
        dragStartPosition.set(
          activePosition.get(),
        );
      })
      .onStart(() => {
        isDragging.set(true);

        dragStartPosition.set(
          activePosition.get(),
        );

        if (!collapsed) {
          runOnJS(expand)();
        }
      })
      .onUpdate(
        (event) => {
          const nextPosition =
            dragStartPosition.get() +
            event.translationX;

          const minPosition =
            edgeInset;

          const maxPosition =
            capsuleWidth -
            activeWidth -
            edgeInset;

          activePosition.set(
            Math.max(
              minPosition,
              Math.min(
                maxPosition,
                nextPosition,
              ),
            ),
          );
        },
      )
      .onEnd(
        (event) => {
          isDragging.set(false);

          const projectedPosition =
            activePosition.get() +
            event.velocityX *
              0.045;

          const projectedCenter =
            projectedPosition +
            activeWidth / 2;

          const nearestIndex =
            Math.max(
              0,
              Math.min(
                tabCount - 1,
                Math.round(
                  (
                    projectedCenter -
                    segmentWidth /
                      2
                  ) /
                    segmentWidth,
                ),
              ),
            );

          runOnJS(
            snapToIndex,
          )(nearestIndex);
        },
      )
      .onFinalize(() => {
        isDragging.set(false);
      });

  useEffect(() => {
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
    collapsed,
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

  useEffect(() => {
    const changed =
      previousIndex.current !==
      state.index;

    previousIndex.current =
      state.index;

    if (!changed) {
      activePosition.set(
        activeOffset,
      );

      return;
    }

    Animated.sequence([
      Animated.parallel([
        Animated.spring(
          activeScaleX,
          {
            toValue: 1.03,
            damping: 22,
            stiffness: 330,
            mass: 0.55,
            useNativeDriver:
              true,
          },
        ),

        Animated.spring(
          activeScaleY,
          {
            toValue: 0.975,
            damping: 22,
            stiffness: 330,
            mass: 0.55,
            useNativeDriver:
              true,
          },
        ),
      ]),

      Animated.parallel([
        Animated.spring(
          activeScaleX,
          {
            toValue: 1,
            damping: 18,
            stiffness: 280,
            mass: 0.65,
            useNativeDriver:
              true,
          },
        ),

        Animated.spring(
          activeScaleY,
          {
            toValue: 1,
            damping: 18,
            stiffness: 280,
            mass: 0.65,
            useNativeDriver:
              true,
          },
        ),
      ]),
    ]).start();

    activePosition.set(
      withSpring(
        activeOffset,
        {
          damping: 23,
          stiffness: 250,
          mass: 0.72,
          energyThreshold:
            0.01,
        },
      ),
    );
  }, [
    activeOffset,
    activePosition,
    activeScaleX,
    activeScaleY,
    state.index,
  ]);

  return (
    <Animated.View
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
        {
          bottom:
            Math.max(
              insets.bottom -
                12,
              8,
            ),
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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.animatedBackground,
          {
            width:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [
                    capsuleWidth,
                    capsuleWidth + 10,
                  ],
                },
              ),
            height:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [62, 66],
                },
              ),
            left:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [0, -5],
                },
              ),
            top:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [0, -2],
                },
              ),
          },
        ]}
      >
        <BlurView
          intensity={34}
          tint="systemUltraThinMaterialLight"
          style={styles.backgroundBar}
        >
          <View
            pointerEvents="none"
            style={
              styles.surfaceTint
            }
          />

          <View
            pointerEvents="none"
            style={
              styles.bottomShade
            }
          />

          <View
            pointerEvents="none"
            style={
              styles.glassHighlight
            }
          />


        </BlurView>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.navbarPressLightOverlay,
          {
            width:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [
                    capsuleWidth,
                    capsuleWidth + 10,
                  ],
                },
              ),
            height:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [62, 66],
                },
              ),
            left:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [0, -5],
                },
              ),
            top:
              navbarPressProgress.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [0, -2],
                },
              ),
            backgroundColor:
              navbarPressBrightness.interpolate(
                {
                  inputRange: [0, 1],
                  outputRange: [
                    'rgba(255,255,255,0)',
                    'rgba(255,255,255,0.92)',
                  ],
                },
              ),
          },
        ]}
      />

      <View
        style={styles.contentBar}
      >

        <Reanimated.View
          pointerEvents="none"
          style={[
            styles.activeVisualArea,
            {
              width:
                activeWidth +
                20,
            },
            activeAnimatedStyle,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.activeSegment,
              {
                left: 10,
                width:
                  activeWidth,
                transform: [
                  {
                    scaleX:
                      activeScaleX,
                  },
                  {
                    scaleY:
                      activeScaleY,
                  },
                ],
              },
            ]}
          >
            <View
              pointerEvents="none"
              style={
                styles.activeTint
              }
            />
          </Animated.View>
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
                tab={tab}
                tabName={
                  route.name
                }
                testID={
                  options.tabBarButtonTestID
                }
              />
            );
          },
        )}

        <GestureDetector
          gesture={
            activePanGesture
          }
        >
          <Reanimated.View
            accessibilityLabel="Drag to switch tabs"
            accessibilityRole="adjustable"
            style={[
              styles.activeGestureArea,
              {
                width:
                  activeWidth +
                  20,
              },
              activeAnimatedStyle,
            ]}
          />
        </GestureDetector>
      </View>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <GestureHandlerRootView
      style={styles.root}
    >
      <TabBarScrollProvider>
        <Tabs
          tabBar={(props) => (
            <VialbumTabBar
              {...props}
            />
          )}
          screenOptions={{
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
              title: 'Search',
            }}
          />

          <Tabs.Screen
            name="create"
            options={{
              title: 'Create',
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
      height: 62,

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
      alignItems:
        'center',

      borderCurve:
        'continuous',

      borderRadius: 31,

      flexDirection:
        'row',

      height: 62,

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

    activeSegment: {
      borderCurve:
        'continuous',

      borderRadius: 28,

      bottom: 9,

      overflow:
        'hidden',

      position:
        'absolute',

      top: 9,
    },

    activeVisualArea: {
      bottom: -5,

      left: -10,

      position:
        'absolute',

      top: -5,

      zIndex: 2,
    },

    activeGestureArea: {
      bottom: -5,

      left: -10,

      position:
        'absolute',

      top: -5,

      zIndex: 20,
    },

    activeTint: {
      position:
        'absolute',

      inset: 0,

      backgroundColor:
        'rgba(232, 232, 234, 0.94)',
    },

    activeGlassBorder: {
      position:
        'absolute',

      inset: 0,

      borderColor:
        'rgba(255, 255, 255, 0.34)',

      borderCurve:
        'continuous',

      borderRadius: 28,

      borderWidth:
        StyleSheet.hairlineWidth,
    },

    activeTopReflection: {
      backgroundColor:
        'rgba(255, 255, 255, 0.36)',

      height:
        StyleSheet.hairlineWidth,

      left: 14,

      position:
        'absolute',

      right: 14,

      top: 1,
    },

    segment: {
      alignItems:
        'center',

      alignSelf:
        'stretch',

      flex: 1,

      justifyContent:
        'center',

      minHeight: 48,

      zIndex: 4,
    },
  });

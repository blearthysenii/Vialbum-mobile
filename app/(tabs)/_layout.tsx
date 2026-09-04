import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import {
  type ComponentProps,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  TabBarScrollProvider,
  useTabBarController,
} from '@/features/navigation/TabBarScrollContext';

type IconName = ComponentProps<typeof Ionicons>['name'];
type BottomTabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>['tabBar']>
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

function isTabName(name: string): name is TabName {
  return name in tabs;
}

type TabButtonProps = {
  tab: TabConfig;
  tabName: TabName;
  focused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  testID?: string;
};

function TabButton({
  tab,
  tabName,
  focused,
  onPress,
  onLongPress,
  testID,
}: TabButtonProps) {
  const pressScale = useRef(
    new Animated.Value(1),
  ).current;

  const iconScale = useRef(
    new Animated.Value(focused ? 1 : 0.96),
  ).current;

  useEffect(() => {
    Animated.spring(iconScale, {
      toValue: focused ? 1 : 0.96,
      damping: 18,
      stiffness: 260,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [focused, iconScale]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.91,
      damping: 18,
      stiffness: 420,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      damping: 15,
      stiffness: 360,
      mass: 0.55,
      useNativeDriver: true,
    }).start();
  };

  const horizontalOffset =
    tabName === 'index'
      ? 5
      : tabName === 'profile'
        ? -5
        : 0;

  return (
    <Pressable
      accessibilityLabel={tab.accessibilityLabel}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onLongPress={onLongPress}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.segment}
      testID={testID}
    >
      <Animated.View
        style={{
          transform: [
            { translateX: horizontalOffset },
            { scale: pressScale },
            { scale: iconScale },
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
  const insets = useSafeAreaInsets();
  const { collapsed, expand } = useTabBarController();

  const { width: screenWidth } =
    useWindowDimensions();

  const capsuleWidth = screenWidth - 40;
  const tabCount = state.routes.length;

  const segmentWidth =
    capsuleWidth / tabCount;

  const activeWidth = Math.min(
    84,
    segmentWidth * 1.16,
  );

  const tabCenter =
    state.index * segmentWidth +
    segmentWidth / 2;

  const edgeInset = 4;

  const rawActiveOffset =
    tabCenter - activeWidth / 2;

  const activeOffset = Math.max(
    edgeInset,
    Math.min(
      capsuleWidth -
        activeWidth -
        edgeInset,
      rawActiveOffset,
    ),
  );

  const activePosition = useRef(
    new Animated.Value(activeOffset),
  ).current;

  const activeScaleX = useRef(
    new Animated.Value(1),
  ).current;

  const activeScaleY = useRef(
    new Animated.Value(1),
  ).current;

  const previousIndex = useRef(
    state.index,
  );

  const collapseProgress = useRef(
    new Animated.Value(collapsed ? 1 : 0),
  ).current;

  useEffect(() => {
    Animated.spring(collapseProgress, {
      toValue: collapsed ? 1 : 0,
      damping: 22,
      stiffness: 260,
      mass: 0.72,
      useNativeDriver: true,
    }).start();
  }, [collapseProgress, collapsed]);

  useEffect(() => {
    expand();
  }, [expand, state.index]);

  useEffect(() => {
    const changed =
      previousIndex.current !== state.index;

    previousIndex.current = state.index;

    if (!changed) {
      activePosition.setValue(
        activeOffset,
      );

      return;
    }

    Animated.parallel([
      Animated.spring(
        activePosition,
        {
          toValue: activeOffset,
          damping: 23,
          stiffness: 250,
          mass: 0.72,
          restDisplacementThreshold: 0.1,
          restSpeedThreshold: 0.1,
          useNativeDriver: true,
        },
      ),

      Animated.sequence([
        Animated.parallel([
          Animated.spring(
            activeScaleX,
            {
              toValue: 1.09,
              damping: 22,
              stiffness: 330,
              mass: 0.55,
              useNativeDriver: true,
            },
          ),

          Animated.spring(
            activeScaleY,
            {
              toValue: 0.975,
              damping: 22,
              stiffness: 330,
              mass: 0.55,
              useNativeDriver: true,
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
              useNativeDriver: true,
            },
          ),

          Animated.spring(
            activeScaleY,
            {
              toValue: 1,
              damping: 18,
              stiffness: 280,
              mass: 0.65,
              useNativeDriver: true,
            },
          ),
        ]),
      ]),
    ]).start();
  }, [
    activeOffset,
    activePosition,
    activeScaleX,
    activeScaleY,
    state.index,
  ]);

  return (
    <Animated.View
      style={[
        styles.shell,
        {
          bottom: Math.max(
            insets.bottom - 12,
            8,
          ),
        },
        {
          transform: [
            {
              scaleX: collapseProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.88],
              }),
            },
            {
              scaleY: collapseProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.82],
              }),
            },
            {
              translateY: collapseProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 5],
              }),
            },
          ],
        },
      ]}
    >
      <BlurView
        intensity={34}
        tint="systemUltraThinMaterialLight"
        style={styles.bar}
      >
        <View
          pointerEvents="none"
          style={styles.surfaceTint}
        />

        <View
          pointerEvents="none"
          style={styles.bottomShade}
        />

        <View
          pointerEvents="none"
          style={styles.glassHighlight}
        />

        <Animated.View
          pointerEvents="none"
          style={[
            styles.activeSegment,
            {
              width: activeWidth,

              transform: [
                {
                  translateX:
                    activePosition,
                },
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
          <BlurView
            intensity={46}
            tint="systemUltraThinMaterialLight"
            style={
              StyleSheet.absoluteFill
            }
          />

          <View
            pointerEvents="none"
            style={styles.activeTint}
          />

          <View
            pointerEvents="none"
            style={
              styles.activeGlassBorder
            }
          />

          <View
            pointerEvents="none"
            style={
              styles.activeTopReflection
            }
          />

        </Animated.View>

        {state.routes.map(
          (route, index) => {
            if (!isTabName(route.name)) {
              return null;
            }

            const focused =
              state.index === index;

            const tab =
              tabs[route.name];

            const options =
              descriptors[
                route.key
              ].options;

            const onPress = () => {
              expand();

              const event =
                navigation.emit({
                  type: 'tabPress',
                  target:
                    route.key,
                  canPreventDefault:
                    true,
                });

              if (
                !focused &&
                !event.defaultPrevented
              ) {
                navigation.navigate(
                  route.name,
                  route.params,
                );
              }
            };

            const onLongPress =
              () => {
                navigation.emit({
                  type: 'tabLongPress',
                  target:
                    route.key,
                });
              };

            return (
              <TabButton
                focused={focused}
                key={route.key}
                onLongPress={
                  onLongPress
                }
                onPress={onPress}
                tab={tab}
                tabName={route.name}
                testID={
                  options.tabBarButtonTestID
                }
              />
            );
          },
        )}
      </BlurView>
    </Animated.View>
  );
}

export default function TabsLayout() {
  return (
    <TabBarScrollProvider>
      <Tabs
      tabBar={(props) => (
        <VialbumTabBar
          {...props}
        />
      )}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
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
  );
}

const styles = StyleSheet.create({
  shell: {
    borderCurve: 'continuous',
    borderRadius: 31,

    elevation: 5,

    left: 20,
    position: 'absolute',
    right: 20,

    shadowColor: '#000000',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.15,
    shadowRadius: 18,

    zIndex: 20,
  },

  bar: {
    alignItems: 'center',

    backgroundColor:
      'rgba(255, 255, 255, 0.025)',

    borderColor:
      'rgba(28, 28, 24, 0.13)',

    borderCurve:
      'continuous',

    borderRadius: 31,

    borderWidth:
      StyleSheet.hairlineWidth,

    flexDirection: 'row',

    height: 62,

    overflow: 'hidden',
  },

  surfaceTint: {
    position: 'absolute',
    inset: 0,

    backgroundColor:
      'rgba(255, 255, 255, 0.028)',
  },

  bottomShade: {
    backgroundColor:
      'rgba(0, 0, 0, 0.007)',

    bottom: 0,

    height: 13,

    left: 0,

    position: 'absolute',

    right: 0,
  },

  glassHighlight: {
    position: 'absolute',
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

    bottom: 4,

    overflow: 'hidden',

    position: 'absolute',

    top: 4,
  },

  activeTint: {
    position: 'absolute',
    inset: 0,

    backgroundColor:
      'rgba(145, 145, 145, 0.105)',
  },

  activeGlassBorder: {
    position: 'absolute',
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

    position: 'absolute',

    right: 14,

    top: 1,
  },

  segment: {
    alignItems: 'center',

    alignSelf: 'stretch',

    flex: 1,

    justifyContent: 'center',

    minHeight: 48,

    zIndex: 2,
  },
});

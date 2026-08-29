import { Tabs } from 'expo-router';
import { ColorValue, Text } from 'react-native';

import { colors } from '@/theme/colors';

const TabIcon = ({ symbol, color }: { symbol: string; color: ColorValue }) => <Text style={{ color, fontSize: 19 }}>{symbol}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: '#9A9891', tabBarStyle: { backgroundColor: colors.tab, borderTopColor: colors.line, height: 84, paddingTop: 8 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Journeys', tabBarIcon: ({ color }) => <TabIcon symbol="◉" color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <TabIcon symbol="⌖" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon symbol="○" color={color} /> }} />
    </Tabs>
  );
}

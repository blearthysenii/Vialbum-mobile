import { Tabs } from 'expo-router';
import { ColorValue, StyleSheet, View } from 'react-native';

import { colors } from '@/theme/colors';

const TabIcon = ({ type, color }: { type: 'journeys' | 'map' | 'profile'; color: ColorValue }) => <View style={[styles.icon, { borderColor: color }]}>
  {type === 'journeys' ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
  {type === 'map' ? <><View style={[styles.pin, { borderColor: color }]} /><View style={[styles.pinDot, { backgroundColor: color }]} /></> : null}
  {type === 'profile' ? <><View style={[styles.head, { backgroundColor: color }]} /><View style={[styles.shoulders, { borderColor: color }]} /></> : null}
</View>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.ink, tabBarInactiveTintColor: '#9A9891', tabBarStyle: { backgroundColor: colors.tab, borderTopColor: colors.line, height: 84, paddingTop: 8 }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}>
      <Tabs.Screen name="index" options={{ title: 'Journeys', tabBarIcon: ({ color }) => <TabIcon type="journeys" color={color} /> }} />
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color }) => <TabIcon type="map" color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <TabIcon type="profile" color={color} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({ icon: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }, dot: { width: 10, height: 10, borderRadius: 5 }, pin: { width: 14, height: 14, borderWidth: 2, borderRadius: 8, transform: [{ rotate: '45deg' }] }, pinDot: { position: 'absolute', width: 4, height: 4, borderRadius: 2 }, head: { position: 'absolute', top: 3, width: 7, height: 7, borderRadius: 4 }, shoulders: { position: 'absolute', bottom: 2, width: 16, height: 9, borderWidth: 2, borderBottomWidth: 0, borderTopLeftRadius: 9, borderTopRightRadius: 9 } });

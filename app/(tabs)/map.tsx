import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfileTheme } from '@/features/profile/theme';
import { MyWorldScreen } from '@/features/travel/MyWorldScreen';
import { WorldMapScreen } from '@/features/world/WorldMapScreen';

export default function MapScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ worldMode?: string; filter?: string }>();
  const [legacy, setLegacy] = useState(!!(params.worldMode || params.filter));
  const insets = useSafeAreaInsets(), theme = useProfileTheme();
  // Keep deep-linked camera focus mounted after the old map consumes its params.
  useEffect(() => { if (params.worldMode || params.filter) setLegacy(true); }, [params.worldMode, params.filter]);
  if (!user) return null;
  return legacy || params.worldMode || params.filter ? <View style={{ flex: 1, paddingTop: 48, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>
    <WorldMapScreen key={user.id} userId={user.id} />
    <Pressable accessibilityRole="button" onPress={() => { router.setParams({ worldMode: undefined, filter: undefined, latitude: undefined, longitude: undefined, focusRequest: undefined }); setLegacy(false); }} style={{ position: 'absolute', top: insets.top, left: 18, minHeight: 44, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 16 })}>‹ My World</Text></Pressable>
  </View> : <MyWorldScreen key={user.id} />;
}

import { resolvePresentationColor, presentationTextStyle } from '@/theme/presentation';
import { useAuth } from '@/features/auth/AuthProvider';
import { WorldMapScreen } from '@/features/world/WorldMapScreen';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileTheme } from '@/features/profile/theme';
export default function PlacesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets(), theme = useProfileTheme();
  return <View style={{ flex: 1, paddingTop: 48, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content') }}>
    {user ? <WorldMapScreen key={user.id} userId={user.id} /> : null}
    <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/map')} style={{ position: 'absolute', top: insets.top, left: 18, minHeight: 44, justifyContent: 'center' }}><Text style={presentationTextStyle({ color: resolvePresentationColor(theme.accent, 'color', 'content'), fontSize: 16 })}>‹ Back</Text></Pressable>
  </View>;
}

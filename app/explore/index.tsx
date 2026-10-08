import { resolvePresentationColor } from '@/theme/presentation';
import { ExploreScreen } from '@/features/explore/ExploreScreen';
import { useAuth } from '@/features/auth/AuthProvider';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileTheme } from '@/features/profile/theme';
import { GlassButton } from '@/features/stays/StayGlass';
import Ionicons from '@expo/vector-icons/Ionicons';
export default function ExploreRoute() {
  const { user } = useAuth(), theme = useProfileTheme(), insets = useSafeAreaInsets();
  return <View style={{ flex: 1, backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'content'), paddingTop: insets.top + 44, paddingBottom: insets.bottom }}><ExploreScreen key={user?.id} /><View style={{ position: 'absolute', top: insets.top, left: 22 }}><GlassButton label="Back" theme={theme} onPress={() => router.back()} radius={22} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="chevron-back" size={22} color={resolvePresentationColor(theme.ink, 'color', 'content')} /></GlassButton></View></View>;
}

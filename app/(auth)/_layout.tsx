import { useNavigationTheme } from '@/features/navigation/theme';
import { Stack } from 'expo-router';

export default function AuthLayout() {
  const theme = useNavigationTheme();
  return <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.canvas } }} />;
}

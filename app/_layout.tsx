import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { LoadingState } from '@/components/ui/Feedback';
import { JourneyProvider } from '@/features/journeys/JourneyProvider';
import { colors } from '@/theme/colors';

function RestoringSession() {
  return (
    <View style={styles.loading}>
      <View style={styles.mark}><Text style={styles.markText}>V</Text></View>
      <LoadingState label="Opening Vialbum…" />
    </View>
  );
}

function RootNavigator() {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <RestoringSession />;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!user}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={Boolean(user)}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="journey/[id]" />
        <Stack.Screen name="journey/[id]/photo/[mediaId]" options={{ animation: 'fade' }} />
        <Stack.Screen name="journey/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="journey/edit/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider><JourneyProvider><RootNavigator /></JourneyProvider></AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({ loading: { flex: 1, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center', gap: 22 }, mark: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' }, markText: { color: colors.canvas, fontSize: 25, fontWeight: '900' } });

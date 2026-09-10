import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { JourneyProvider } from '@/features/journeys/JourneyProvider';
import { AnimatedLaunchScreen } from '@/components/launch/AnimatedLaunchScreen';
import { colors } from '@/theme/colors';

function RootNavigator() {
  const { user, isRestoring } = useAuth();
  const [launchComplete, setLaunchComplete] = useState(false);
  const finishLaunch = useCallback(() => setLaunchComplete(true), []);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!user}><Stack.Screen name="(auth)" /></Stack.Protected>
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="journey/[id]" options={{ contentStyle: { backgroundColor: colors.glassCanvas } }} />
          <Stack.Screen name="journey/[id]/photo/[mediaId]" options={{ animation: 'fade' }} />
          <Stack.Screen name="journey/new" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="journey/edit/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack.Protected>
      </Stack>
      {!launchComplete ? <AnimatedLaunchScreen ready={!isRestoring} onComplete={finishLaunch} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.canvas } });

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider><JourneyProvider><RootNavigator /></JourneyProvider></AuthProvider>
    </SafeAreaProvider>
  );
}

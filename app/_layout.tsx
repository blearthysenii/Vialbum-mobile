import { usePresentationStyles, resolvePresentationColor } from '@/theme/presentation';
import * as SplashScreen from 'expo-splash-screen';
import { appearanceStore, useAppearancePreference } from '@/theme/appearance';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { JourneyProvider } from '@/features/journeys/JourneyProvider';
import { AnimatedLaunchScreen } from '@/components/launch/AnimatedLaunchScreen';
import { colors } from '@/theme/colors';
import { useNavigationTheme } from '@/features/navigation/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

function RootNavigator() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useNavigationTheme();
  const { user, isRestoring } = useAuth();
  const [launchComplete, setLaunchComplete] = useState(false);
  const finishLaunch = useCallback(() => setLaunchComplete(true), []);

  return (
    <View style={[styles.root, { backgroundColor: resolvePresentationColor(theme.canvas, 'backgroundColor', 'canvas') }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.canvas }, animation: 'slide_from_right' }}>
        <Stack.Protected guard={!user}><Stack.Screen name="(auth)" /></Stack.Protected>
        <Stack.Protected guard={Boolean(user)}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="moment/[id]" />
          <Stack.Screen name="moment/place/[id]" />
          <Stack.Screen name="moment/drafts" />
          <Stack.Screen name="moment/new" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
          <Stack.Screen name="saved-moments" />
          <Stack.Screen name="discover/journey/[id]" />
          <Stack.Screen name="post/[id]" />
          <Stack.Screen name="public-profile/[id]" />
          <Stack.Screen name="public-profile/[id]/connections" />
          <Stack.Screen name="saved-journeys" />
          <Stack.Screen name="world/country" />
          <Stack.Screen name="world/countries" />
          <Stack.Screen name="world/places" />
          <Stack.Screen name="explore/index" />
          <Stack.Screen name="explore/place/[id]" />
          <Stack.Screen name="journey/[id]" options={{ contentStyle: { backgroundColor: resolvePresentationColor(colors.glassCanvas, 'backgroundColor', 'canvas') } }} />
          <Stack.Screen name="journey/[id]/photo/[mediaId]" options={{ presentation: 'transparentModal', animation: 'none', gestureEnabled: false, contentStyle: { backgroundColor: 'transparent' } }} />
          <Stack.Screen name="journey/new" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="journey/drafts" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="create" />
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
const presentationBaselineStyles = styles;

export default function RootLayout() {
  const styles = usePresentationStyles(presentationBaselineStyles);

  const theme = useNavigationTheme();
  const { ready } = useAppearancePreference();
  useEffect(() => { void appearanceStore.restore(); }, []);
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  return (
    <GestureHandlerRootView style={styles.root}><SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {ready ? <AuthProvider><JourneyProvider><RootNavigator /></JourneyProvider></AuthProvider> : null}
    </SafeAreaProvider></GestureHandlerRootView>
  );
}

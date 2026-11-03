import {
  NotoSansTamil_400Regular,
  NotoSansTamil_500Medium,
  NotoSansTamil_600SemiBold,
} from '@expo-google-fonts/noto-sans-tamil';
import { Outfit_700Bold, useFonts } from '@expo-google-fonts/outfit';
import { DarkTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useSyncExternalStore } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { getAuthReadySnapshot, restoreSession, subscribeToAuthReady } from '@/lib/data/auth';

SplashScreen.preventAutoHideAsync();
restoreSession();

const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
    notification: Colors.accent,
  },
};

export default function RootLayout() {
  const session = useSession();
  const signedIn = session !== null;
  const authReady = useSyncExternalStore(subscribeToAuthReady, getAuthReadySnapshot);
  const [fontsLoaded, fontError] = useFonts({
    Outfit_700Bold,
    NotoSansTamil_400Regular,
    NotoSansTamil_500Medium,
    NotoSansTamil_600SemiBold,
  });

  const fontsReady = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontsReady && authReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsReady, authReady]);

  // Stay on the splash until we know whether someone is signed in. If fonts fail to load,
  // render anyway with the system font rather than hang.
  if (!fontsReady || !authReady) {
    return null;
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: Fonts.heading },
          headerTintColor: Colors.text,
          headerStyle: { backgroundColor: Colors.background },
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
          <Stack.Screen name="profile" options={{ title: 'Profile' }} />
          <Stack.Screen name="list" options={{ title: 'List an item' }} />
          <Stack.Screen name="listing/[id]" options={{ title: '' }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="user/[id]" options={{ title: '' }} />
          <Stack.Screen name="request/[listingId]" options={{ title: 'Request to borrow' }} />
          <Stack.Screen name="buy/[listingId]" options={{ title: 'Request to buy' }} />
          <Stack.Screen name="sale/[id]" options={{ title: '' }} />
          <Stack.Screen name="rental/[id]" options={{ title: '' }} />
          <Stack.Screen name="review/[rentalId]" options={{ title: 'Review', presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" options={{ title: 'Edit profile', presentation: 'modal' }} />
          <Stack.Screen name="manage/[listingId]" options={{ title: 'Manage listing' }} />
          <Stack.Screen name="edit-listing/[listingId]" options={{ title: 'Edit listing' }} />
          <Stack.Screen name="report/[userId]" options={{ title: 'Report', presentation: 'modal' }} />
          <Stack.Screen name="admin/reports" options={{ title: 'Reports' }} />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" options={{ headerShown: false, title: 'Back' }} />
          <Stack.Screen name="sign-in" options={{ title: 'Log in' }} />
          <Stack.Screen name="sign-up" options={{ title: 'Sign up' }} />
          <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

import { Lora_400Regular, Lora_500Medium, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { PlayfairDisplay_600SemiBold, useFonts } from '@expo-google-fonts/playfair-display';
import { DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useSyncExternalStore } from 'react';

import { Colors, Fonts } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { getAuthReadySnapshot, restoreSession, subscribeToAuthReady } from '@/lib/data/auth';

SplashScreen.preventAutoHideAsync();
restoreSession();

const navigationTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.accent,
    background: Colors.background,
    card: Colors.background,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  const session = useSession();
  const signedIn = session !== null;
  const authReady = useSyncExternalStore(subscribeToAuthReady, getAuthReadySnapshot);
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    Lora_400Regular,
    Lora_500Medium,
    Lora_600SemiBold,
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
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: Fonts.heading },
          headerTintColor: Colors.text,
        }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Back' }} />
          <Stack.Screen name="listing/[id]" options={{ title: '' }} />
          <Stack.Screen name="chat/[id]" options={{ title: '' }} />
          <Stack.Screen name="user/[id]" options={{ title: '' }} />
          <Stack.Screen name="request/[listingId]" options={{ title: 'Request to borrow' }} />
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
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

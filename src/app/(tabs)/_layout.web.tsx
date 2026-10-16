import Tabs from 'expo-router/js-tabs';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Web uses JS tabs: a regular bottom bar, since native tabs are built for iOS and Android. */
export default function TabLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background, borderTopColor: theme.border },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelStyle: { fontFamily: Fonts.bodyMedium, fontSize: 13 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="list" options={{ title: 'List' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Inbox' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

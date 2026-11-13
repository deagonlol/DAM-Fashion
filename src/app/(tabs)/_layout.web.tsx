import { Tabs } from 'expo-router/js-tabs';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useUnreadChatCount } from '@/hooks/use-conversations';
import { useTheme } from '@/hooks/use-theme';

/** Web uses JS tabs: a regular bottom bar, since native tabs are built for iOS and Android. */
export default function TabLayout() {
  const theme = useTheme();
  const unreadChats = useUnreadChatCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
        tabBarLabelStyle: { fontFamily: Fonts.bodyMedium, fontSize: 12 },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: icon({ ios: 'house', android: 'home', web: 'home' }),
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          tabBarBadge: unreadChats > 0 ? unreadChats : undefined,
          tabBarBadgeStyle: { backgroundColor: theme.accent, color: theme.onAccent },
          tabBarIcon: icon({
            ios: 'envelope',
            android: 'mail',
            web: 'mail',
          }),
        }}
      />
      <Tabs.Screen
        name="closet"
        options={{
          title: 'Closet',
          tabBarIcon: icon({
            ios: 'tshirt',
            android: 'checkroom',
            web: 'checkroom',
          }),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarIcon: icon({
            ios: 'bag',
            android: 'shopping_bag',
            web: 'shopping_bag',
          }),
        }}
      />
    </Tabs>
  );
}

/** The same outline icons the native tab bar uses. */
function icon(name: SymbolViewProps['name']) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  }
  return TabIcon;
}

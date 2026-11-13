import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Fonts } from '@/constants/theme';
import { useUnreadChatCount } from '@/hooks/use-conversations';
import { useTheme } from '@/hooks/use-theme';

export default function TabLayout() {
  const theme = useTheme();
  const unreadChats = useUnreadChatCount();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundElement}
      tintColor={theme.accent}
      labelStyle={{
        default: { fontFamily: Fonts.bodyMedium, color: theme.textSecondary },
        selected: { fontFamily: Fonts.bodyMedium, color: theme.accent },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="inbox">
        <NativeTabs.Trigger.Label>Inbox</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'envelope', selected: 'envelope.fill' }} md="mail" />
        <NativeTabs.Trigger.Badge hidden={unreadChats === 0}>{String(unreadChats)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="closet">
        <NativeTabs.Trigger.Label>Closet</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'tshirt', selected: 'tshirt.fill' }} md="checkroom" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="orders">
        <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'bag', selected: 'bag.fill' }} md="shopping_bag" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

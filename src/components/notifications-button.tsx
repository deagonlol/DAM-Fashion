import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useNotices } from '@/hooks/use-notices';
import { useTheme } from '@/hooks/use-theme';

/** Header bell. The badge is unread messages plus reminders that need you. */
export function NotificationsButton() {
  const theme = useTheme();
  const count = useNotices().length;

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      accessibilityRole="link"
      accessibilityLabel={count > 0 ? `Notifications, ${count} waiting` : 'Notifications'}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView
        name={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
        tintColor={theme.text}
        size={24}
      />
      {count > 0 ? (
        <View style={[styles.badge, { backgroundColor: theme.accent }]}>
          <ThemedText type="small" style={[styles.badgeText, { color: theme.onAccent }]}>
            {count > 9 ? '9+' : String(count)}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});

import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useReminders } from '@/hooks/use-reminders';
import { useTheme } from '@/hooks/use-theme';

const SHOWN = 3;

/** Home's "Coming up" card: the next few things that need you. Hidden when there's nothing. */
export function ComingUp() {
  const theme = useTheme();
  const reminders = useReminders();
  if (reminders.length === 0) return null;
  const shown = reminders.slice(0, SHOWN);
  const more = reminders.length - shown.length;

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">Coming up</ThemedText>
      {shown.map((reminder) => (
        <Pressable
          key={reminder.key}
          onPress={() => router.push(reminder.href as Href)}
          accessibilityRole="link"
          accessibilityLabel={[reminder.title, reminder.detail].filter(Boolean).join('. ')}
          style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor:
                  reminder.tone === 'danger'
                    ? theme.danger
                    : reminder.tone === 'accent'
                      ? theme.accent
                      : theme.textSecondary,
              },
            ]}
          />
          <View style={styles.text}>
            <ThemedText type="smallBold" themeColor={reminder.tone === 'danger' ? 'danger' : 'text'} numberOfLines={1}>
              {reminder.title}
            </ThemedText>
            {reminder.detail ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {reminder.detail}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>
      ))}
      {more > 0 ? (
        <Pressable onPress={() => router.push('/orders')} accessibilityRole="link" hitSlop={8}>
          <ThemedText type="small" themeColor="accent">
            {more} more in Orders ›
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    flex: 1,
  },
});

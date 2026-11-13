import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useNotices } from '@/hooks/use-notices';
import { useTheme } from '@/hooks/use-theme';
import { sendTestNotification } from '@/lib/schedule-reminders';

/** Unread messages, requests, and upcoming handoffs. Phone alerts are scheduled from the same borrows. */
export default function NotificationsScreen() {
  const theme = useTheme();
  const notices = useNotices();
  const [testStatus, setTestStatus] = useState<string | null>(null);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">
          Pickup and return alerts also show on your phone: the evening before, an hour before, and on the return day.
        </ThemedText>
        {notices.length === 0 ? (
          <ThemedText>Nothing needs you right now.</ThemedText>
        ) : (
          notices.map((notice) => (
            <Pressable
              key={notice.key}
              onPress={() => router.push(notice.href as Href)}
              accessibilityRole="link"
              accessibilityLabel={[notice.title, notice.detail].filter(Boolean).join('. ')}
              style={({ pressed }) => [
                styles.row,
                { borderColor: theme.border, backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      notice.tone === 'danger'
                        ? theme.danger
                        : notice.tone === 'accent'
                          ? theme.accent
                          : theme.textSecondary,
                  },
                ]}
              />
              <View style={styles.text}>
                <ThemedText type="smallBold" themeColor={notice.tone === 'danger' ? 'danger' : 'text'}>
                  {notice.title}
                </ThemedText>
                {notice.detail ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {notice.detail}
                  </ThemedText>
                ) : null}
              </View>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          ))
        )}
        {__DEV__ ? (
          <View style={styles.test}>
            <Button
              title="Send a test notification"
              variant="secondary"
              onPress={async () => {
                setTestStatus('Scheduling…');
                const problem = await sendTestNotification();
                setTestStatus(problem ?? 'Sent. It shows up in about 5 seconds, even with the app open.');
              }}
            />
            {testStatus ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                {testStatus}
              </ThemedText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  test: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
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
    gap: 2,
  },
});

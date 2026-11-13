import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { NotificationsButton } from '@/components/notifications-button';
import { ProfileButton } from '@/components/profile-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type TabHeaderProps = {
  title: string;
  /** The search bar and anything under it (chips, segments). Same spacing on every tab. */
  children?: ReactNode;
  style?: object;
};

/**
 * The top of every tab: title on the left, bell and profile photo on the right, then the search
 * bar. One component so the title, icons, and search bar sit in exactly the same place everywhere.
 */
export function TabHeader({ title, children, style }: TabHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleRow}>
        <ThemedText type="subtitle" themeColor="accent" numberOfLines={1} style={styles.title}>
          {title}
        </ThemedText>
        <View style={styles.actions}>
          <NotificationsButton />
          <ProfileButton />
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 40,
  },
  title: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

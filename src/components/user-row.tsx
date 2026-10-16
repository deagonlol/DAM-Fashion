import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { TopBadge } from '@/components/badge-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useUserStats } from '@/hooks/use-users';
import type { User } from '@/lib/data/types';

/** A person in search results. Opens their profile. */
export function UserRow({ user }: { user: User }) {
  const stats = useUserStats(user.id);
  const details = [
    `${stats.listingCount} listed`,
    `${stats.lendCount} lent`,
    stats.rating !== null ? `★ ${stats.rating.toFixed(1)}` : null,
  ].filter(Boolean);

  return (
    <Pressable
      onPress={() => router.push(`/user/${user.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Avatar name={user.name} uri={user.avatarUrl} size={48} />
      <View style={styles.text}>
        <View style={styles.nameRow}>
          <ThemedText type="smallBold">{user.name}</ThemedText>
          <TopBadge userId={user.id} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {details.join(' · ')}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

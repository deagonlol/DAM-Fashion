import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BadgeRow } from '@/components/badge-row';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUserStats } from '@/hooks/use-users';
import type { User } from '@/lib/data/types';
import { formatMonthYear } from '@/lib/format';

type ProfileHeaderProps = {
  user: User;
  /** Extra content under the stats, e.g. a sign-out button on your own profile. */
  children?: ReactNode;
  /** When set, the avatar is tappable (used on your own profile to change the photo). */
  onAvatarPress?: () => void;
};

/** Avatar, name, and lending stats. Shared by your own profile and other people's. */
export function ProfileHeader({ user, children, onAvatarPress }: ProfileHeaderProps) {
  const theme = useTheme();
  const stats = useUserStats(user.id);

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        {onAvatarPress ? (
          <Pressable
            onPress={onAvatarPress}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            style={({ pressed }) => pressed && styles.pressed}>
            <Avatar name={user.name} uri={user.avatarUrl} size={72} />
            <View style={[styles.editBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
              <ThemedText type="smallBold" style={[styles.editBadgeText, { color: theme.onAccent }]}>
                +
              </ThemedText>
            </View>
          </Pressable>
        ) : (
          <Avatar name={user.name} uri={user.avatarUrl} size={72} />
        )}
        <View style={styles.identityText}>
          <ThemedText type="subtitle" numberOfLines={1}>
            {user.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Member since {formatMonthYear(user.joinedAt)}
          </ThemedText>
        </View>
      </View>

      <BadgeRow userId={user.id} />

      {user.bio ? <ThemedText type="small">{user.bio}</ThemedText> : null}

      <View style={[styles.stats, { backgroundColor: theme.backgroundElement }]}>
        <Stat value={String(stats.lendCount)} label="Lent" />
        <Stat value={String(stats.borrowCount)} label="Borrowed" />
        <Stat
          value={stats.rating !== null ? `★ ${stats.rating.toFixed(1)}` : '—'}
          label={stats.reviewCount === 1 ? '1 review' : `${stats.reviewCount} reviews`}
        />
      </View>

      {stats.topEvents.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Go-to for: {stats.topEvents.join(' · ')}
        </ThemedText>
      ) : null}

      {children}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <ThemedText type="subtitle" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editBadgeText: {
    fontSize: 14,
    lineHeight: 18,
  },
  stats: {
    flexDirection: 'row',
    borderRadius: 12,
    paddingVertical: Spacing.three,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    lineHeight: 30,
  },
});

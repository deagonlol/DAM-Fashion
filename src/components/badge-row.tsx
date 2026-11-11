import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBadges } from '@/hooks/use-users';
import { BADGES, type BadgeId } from '@/lib/data/badges';

/** All of a user's badges, for their profile. */
export function BadgeRow({ userId }: { userId: string }) {
  const badges = useBadges(userId);
  if (badges.length === 0) return null;
  return (
    <View style={styles.row}>
      {badges.map((badge) => (
        <Badge key={badge} id={badge} />
      ))}
    </View>
  );
}

/** The user's most meaningful badge beyond "UT email", for compact rows. */
export function TopBadge({ userId }: { userId: string }) {
  const badges = useBadges(userId);
  const top = badges.find((badge) => badge !== 'verified_student');
  return top ? <Badge id={top} compact /> : null;
}

export function Badge({ id, compact = false }: { id: BadgeId; compact?: boolean }) {
  const theme = useTheme();
  const badge = BADGES[id];
  return (
    <View
      style={[styles.badge, { backgroundColor: theme.backgroundSelected }, compact && styles.compact]}
      accessible
      accessibilityLabel={`${badge.label}: ${badge.description}`}>
      <ThemedText type="small" style={[styles.text, { color: theme.text }]}>
        {badge.icon} {badge.label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    alignSelf: 'flex-start',
  },
  compact: {
    paddingHorizontal: Spacing.one + Spacing.half,
  },
  text: {
    fontSize: 12,
    lineHeight: 18,
  },
});

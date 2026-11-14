import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import type { ActivityItem } from '@/hooks/use-rentals';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import type { RentalStatus } from '@/lib/data/types';
import { formatDateRange, formatPricePerDay } from '@/lib/format';

export const STATUS_LABELS: Record<RentalStatus, string> = {
  requested: 'Requested',
  accepted: 'Pickup scheduled',
  declined: 'Declined',
  cancelled: 'Cancelled',
  picked_up: 'Out on borrow',
  returned: 'Returned',
  no_show: 'Missed pickup',
  lost: 'Reported lost',
};

/** One in-progress borrow in the activity list. Opens the borrow's detail screen. */
export function RentalRow({ item }: { item: ActivityItem }) {
  const theme = useTheme();
  const { rental, role, needsAction } = item;
  const listing = useListing(rental.listingId);
  const other = useUser(role === 'borrower' ? rental.lenderId : rental.borrowerId);
  const urgent = needsAction?.startsWith('Overdue') ?? false;

  return (
    <Pressable
      onPress={() => router.push(`/rental/${rental.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.row, { borderColor: theme.border }, pressed && styles.pressed]}>
      {listing ? (
        <Image
          source={listing.imageUris[0]}
          style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
        />
      ) : null}
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing?.title ?? 'Item'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {role === 'borrower' ? 'From' : 'To'} {other?.name ?? 'someone'} · {formatDateRange(rental.startDate, rental.endDate)}
          {rental.offeredPricePerDay != null ? ` · ${formatPricePerDay(rental.offeredPricePerDay)}` : ''}
        </ThemedText>
        <ThemedText
          type="smallBold"
          themeColor={urgent ? 'danger' : needsAction ? 'accent' : 'textSecondary'}
          numberOfLines={1}>
          {needsAction ?? STATUS_LABELS[rental.status]}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 44,
    height: 56,
    borderRadius: 6,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});

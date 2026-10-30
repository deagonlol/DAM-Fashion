import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { formatRemainingTime, isOverdue } from '@/lib/data/rentals';
import type { Rental } from '@/lib/data/types';
import { formatDateRange } from '@/lib/format';

/** A currently-out borrow as a listing-style card. Opens the rental detail screen. */
export function OrderCard({ rental }: { rental: Rental }) {
  const theme = useTheme();
  const listing = useListing(rental.listingId);
  const now = useNow();
  const overdue = isOverdue(rental, now);

  return (
    <Pressable
      onPress={() => router.push(`/rental/${rental.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {listing ? (
        <Image
          source={listing.imageUris[0]}
          style={[styles.image, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.image, { backgroundColor: theme.backgroundElement }]} />
      )}
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing?.title ?? 'Item'}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateRange(rental.startDate, rental.endDate)}
        </ThemedText>
        {listing ? (
          <ThemedText type="small" themeColor="textSecondary">
            {listing.size} · {listing.category}
          </ThemedText>
        ) : null}
        <ThemedText type="smallBold" themeColor={overdue ? 'danger' : 'accent'}>
          {formatRemainingTime(rental, now)}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 24,
  },
  info: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
});

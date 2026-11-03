import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import type { SaleActivity } from '@/hooks/use-sales';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { formatPrice } from '@/lib/format';

/** One buy request in the activity list. Opens the sale's detail screen. */
export function SaleRow({ item }: { item: SaleActivity }) {
  const theme = useTheme();
  const { sale, role, needsAction } = item;
  const listing = useListing(sale.listingId);
  const other = useUser(role === 'borrower' ? sale.sellerId : sale.buyerId);

  return (
    <Pressable
      onPress={() => router.push(`/sale/${sale.id}`)}
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
          {role === 'borrower' ? 'From' : 'To'} {other?.name ?? 'someone'} · {formatPrice(sale.price)} to buy
        </ThemedText>
        <ThemedText type="smallBold" themeColor={needsAction && needsAction !== 'Sold' ? 'accent' : 'textSecondary'} numberOfLines={1}>
          {needsAction ?? 'Buy request'}
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

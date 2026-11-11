import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Listing } from '@/lib/data/types';
import { formatPrice, formatPricePerDay } from '@/lib/format';

export function ListingCard({ listing }: { listing: Listing }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.card },
        pressed && styles.pressed,
      ]}>
      <View>
        <Image
          source={listing.imageUris[0]}
          style={[styles.image, { backgroundColor: theme.backgroundElement }]}
          contentFit="contain"
          transition={150}
        />
        <SaveButton listingId={listing.id} />
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1} style={{ color: theme.background }}>
          {listing.title}
        </ThemedText>
        <ThemedText type="small" numberOfLines={1} style={{ color: theme.textSecondary }}>
          {listing.brand ? `${listing.size} · ${listing.brand}` : `Size ${listing.size}`}
        </ThemedText>
        <ThemedText type="small" numberOfLines={2} style={{ color: theme.accent }}>
          {listing.soldAt
            ? 'Sold'
            : `${formatPricePerDay(listing.pricePerDay)}${
                listing.salePrice != null ? ` · ${formatPrice(listing.salePrice)} to buy` : ''
              }`}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: '100%',
    aspectRatio: 1,
  },
  info: {
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
    gap: Spacing.half,
  },
});

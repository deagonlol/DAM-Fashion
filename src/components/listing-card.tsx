import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Listing } from '@/lib/data/types';
import { formatPricePerDay } from '@/lib/format';

export function ListingCard({ listing }: { listing: Listing }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="link"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View>
        <Image
          source={listing.imageUris[0]}
          style={[styles.image, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
          transition={150}
        />
        <SaveButton listingId={listing.id} />
      </View>
      <View style={styles.info}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {listing.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatPricePerDay(listing.pricePerDay)} · {listing.size}
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
    borderRadius: 12,
  },
  info: {
    paddingTop: Spacing.two,
    gap: Spacing.half,
  },
});

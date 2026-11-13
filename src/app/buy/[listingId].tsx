import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { PriceBreakdown } from '@/components/price-breakdown';
import { RestrictionBanner } from '@/components/restriction-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { requestSale } from '@/lib/data/sales';
import { salePrice } from '@/lib/fees';
import { formatPrice, formatPricePerDay } from '@/lib/format';

/** Confirm a buy at the listed sale price. The seller accepts or declines. */
export default function BuyScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!listing || listing.salePrice == null) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">This item is not for sale.</ThemedText>
      </ThemedView>
    );
  }

  async function handleSubmit() {
    if (!listing || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const sale = await requestSale(listing.id);
      router.replace(`/sale/${sale.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Request to buy' }} />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
          <ThemedText type="subtitle">{listing.title}</ThemedText>
          <RestrictionBanner />
          <ThemedText>
            Buy it for {formatPrice(listing.salePrice)}. It also rents for {formatPricePerDay(listing.pricePerDay)}.
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            The seller accepts or declines. If they accept, the item is marked sold.
          </ThemedText>
          <PriceBreakdown role="payer" label="Item price" price={salePrice(listing.salePrice)} />
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
          <Button title="Request to buy" onPress={handleSubmit} disabled={submitting || listing.soldAt != null} />
          {listing.soldAt ? (
            <ThemedText type="small" themeColor="textSecondary">
              This item has been sold.
            </ThemedText>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
});

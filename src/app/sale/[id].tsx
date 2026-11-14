import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { PriceBreakdown } from '@/components/price-breakdown';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useSale } from '@/hooks/use-sales';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { getOrCreateConversation } from '@/lib/data/messages';
import { acceptSale, cancelSale, declineSale } from '@/lib/data/sales';
import type { SaleStatus } from '@/lib/data/types';
import { salePrice } from '@/lib/fees';
import { formatPrice } from '@/lib/format';

const STATUS_LABELS: Record<SaleStatus, string> = {
  requested: 'Buy request',
  accepted: 'Sold',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

/** One buy request, with accept and decline for the seller. */
export default function SaleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sale = useSale(id);
  const listing = useListing(sale?.listingId);
  const user = useCurrentUser();
  const theme = useTheme();
  const role = sale?.buyerId === user.id ? 'borrower' : sale?.sellerId === user.id ? 'lender' : null;
  const other = useUser(role === 'borrower' ? sale?.sellerId : sale?.buyerId);
  const [error, setError] = useState<string | null>(null);

  if (!sale || !role) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Buy request not found.</ThemedText>
      </ThemedView>
    );
  }

  const otherName = other?.name ?? (role === 'borrower' ? 'the seller' : 'the buyer');
  const firstName = otherName.split(' ')[0];

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  async function openChat() {
    if (!listing) return;
    try {
      const conversation = await getOrCreateConversation(listing.id, role === 'lender' ? sale?.buyerId : undefined);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: STATUS_LABELS[sale.status] }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        {listing ? (
          <Pressable
            onPress={() => router.push(`/listing/${listing.id}`)}
            accessibilityRole="link"
            style={styles.itemRow}>
            <Image
              source={listing.imageUris[0]}
              style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
              contentFit="cover"
            />
            <View style={styles.flex}>
              <ThemedText type="smallBold">{listing.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatPrice(sale.price)} to buy
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => router.push(`/user/${other?.id ?? ''}`)}
          accessibilityRole="link"
          style={styles.person}>
          <Avatar name={otherName} uri={other?.avatarUrl} size={32} />
          <ThemedText type="small" style={styles.flex}>
            {role === 'borrower' ? 'Seller' : 'Buyer'}: {otherName}
          </ThemedText>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </Pressable>

        {sale.status !== 'declined' && sale.status !== 'cancelled' ? (
          <PriceBreakdown
            role={role === 'borrower' ? 'payer' : 'payee'}
            label="Item price"
            price={salePrice(sale.price)}
          />
        ) : null}

        {sale.status === 'requested' && role === 'lender' ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>
              {firstName} wants to buy this for {formatPrice(sale.price)}. Accepting marks it sold and declines other
              requests.
            </ThemedText>
            <View style={styles.row}>
              <Button
                title="Decline"
                variant="danger"
                style={styles.flex}
                onPress={() => run(() => declineSale(sale.id))}
              />
              <Button title="Accept" style={styles.flex} onPress={() => run(() => acceptSale(sale.id))} />
            </View>
          </View>
        ) : null}

        {sale.status === 'requested' && role === 'borrower' ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>Waiting for {firstName} to respond.</ThemedText>
            <Button title="Cancel request" variant="secondary" onPress={() => run(() => cancelSale(sale.id))} />
          </View>
        ) : null}

        {sale.status === 'accepted' ? (
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText>
              Sold to {role === 'lender' ? firstName : 'you'} for {formatPrice(sale.price)}. Arrange pickup in the chat.
            </ThemedText>
            <Button title="Message" variant="secondary" onPress={openChat} />
          </View>
        ) : null}

        {sale.status === 'declined' || sale.status === 'cancelled' ? (
          <ThemedText themeColor="textSecondary">{STATUS_LABELS[sale.status]}.</ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
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
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
});

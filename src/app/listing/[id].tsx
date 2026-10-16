import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { TopBadge } from '@/components/badge-row';
import { Button } from '@/components/button';
import { PhotoCarousel } from '@/components/photo-carousel';
import { ReviewCard } from '@/components/review-card';
import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useListingReviews } from '@/hooks/use-reviews';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser, useUserStats } from '@/hooks/use-users';
import { getOrCreateConversation } from '@/lib/data/messages';
import { formatDateRange, formatPricePerDay } from '@/lib/format';

const REVIEWS_SHOWN = 3;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const owner = useUser(listing?.ownerId);
  const ownerStats = useUserStats(listing?.ownerId ?? '');
  const currentUser = useCurrentUser();
  const rentals = useRentals();
  const reviews = useListingReviews(id);
  const theme = useTheme();
  const [error, setError] = useState<string | null>(null);

  // The viewer's own borrow of this item that's still in progress, if any.
  const myOpenBorrow = useMemo(
    () =>
      rentals.find(
        (rental) =>
          rental.listingId === id &&
          rental.borrowerId === currentUser.id &&
          ['requested', 'accepted', 'picked_up'].includes(rental.status)
      ),
    [rentals, id, currentUser.id]
  );
  const incomingRequests = useMemo(
    () => rentals.filter((rental) => rental.listingId === id && rental.status === 'requested'),
    [rentals, id]
  );
  const upcoming = useMemo(
    () =>
      rentals
        .filter((rental) => rental.listingId === id && (rental.status === 'accepted' || rental.status === 'picked_up'))
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [rentals, id]
  );

  if (!listing) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  const isOwnListing = listing.ownerId === currentUser.id;

  async function openChat() {
    if (!listing) return;
    setError(null);
    try {
      const conversation = await getOrCreateConversation(listing.id);
      router.push(`/chat/${conversation.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open chat.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <PhotoCarousel uris={listing.imageUris} label={listing.title} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" style={styles.flex}>
              {listing.title}
            </ThemedText>
            <SaveButton listingId={listing.id} variant="inline" />
          </View>
          <ThemedText type="smallBold">{formatPricePerDay(listing.pricePerDay)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {listing.category} · Size {listing.size}
          </ThemedText>
          {listing.events.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Good for: {listing.events.join(', ')}
            </ThemedText>
          ) : null}
          {listing.description ? <ThemedText>{listing.description}</ThemedText> : null}

          {upcoming.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Booked: {upcoming.map((rental) => formatDateRange(rental.startDate, rental.endDate)).join(', ')}
            </ThemedText>
          ) : null}

          <Pressable
            onPress={() => router.push(`/user/${listing.ownerId}`)}
            accessibilityRole="link"
            accessibilityHint="Opens the lender's profile"
            style={({ pressed }) => [styles.seller, { borderColor: theme.border }, pressed && styles.pressed]}>
            <Avatar name={owner?.name ?? '?'} uri={owner?.avatarUrl} />
            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <ThemedText type="smallBold">{isOwnListing ? 'You' : (owner?.name ?? 'Unknown')}</ThemedText>
                <TopBadge userId={listing.ownerId} />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                {ownerStats.rating !== null ? `★ ${ownerStats.rating.toFixed(1)} · ` : ''}
                {ownerStats.lendCount} lent
              </ThemedText>
            </View>
            <ThemedText themeColor="textSecondary">›</ThemedText>
          </Pressable>

          {reviews.length > 0 ? (
            <View style={styles.reviews}>
              <ThemedText type="smallBold">From people who borrowed this</ThemedText>
              {reviews.slice(0, REVIEWS_SHOWN).map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
              {reviews.length > REVIEWS_SHOWN ? (
                <Pressable onPress={() => router.push(`/user/${listing.ownerId}`)} accessibilityRole="link">
                  <ThemedText type="small" themeColor="accent">
                    See all reviews on {owner?.name.split(' ')[0] ?? 'their'}’s profile
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {!isOwnListing ? (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/report/[userId]',
                  params: { userId: listing.ownerId, listingId: listing.id, reason: 'Item not as described' },
                })
              }
              accessibilityRole="button"
              hitSlop={8}
              style={styles.reportLink}>
              <ThemedText type="small" themeColor="textSecondary">
                Report this listing
              </ThemedText>
            </Pressable>
          ) : null}

          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.actions, { borderColor: theme.border }]}>
        {isOwnListing ? (
          <>
            <Button
              title="Manage listing"
              variant="secondary"
              style={styles.flex}
              onPress={() => router.push(`/manage/${listing.id}`)}
            />
            {incomingRequests.length > 0 ? (
              <Button
                title={`${incomingRequests.length} request${incomingRequests.length === 1 ? '' : 's'}`}
                style={styles.flex}
                onPress={() => router.push(`/rental/${incomingRequests[0].id}`)}
              />
            ) : null}
          </>
        ) : listing.paused && !myOpenBorrow ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.ownNote}>
            Not available to borrow right now.
          </ThemedText>
        ) : (
          <>
            <Button title="Message" variant="secondary" style={styles.flex} onPress={openChat} />
            {myOpenBorrow ? (
              <Button title="View your borrow" style={styles.flex} onPress={() => router.push(`/rental/${myOpenBorrow.id}`)} />
            ) : (
              <Button title="Request to borrow" style={styles.flex} onPress={() => router.push(`/request/${listing.id}`)} />
            )}
          </>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.four,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reportLink: {
    marginTop: Spacing.three,
    alignSelf: 'flex-start',
  },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    marginTop: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  reviews: {
    marginTop: Spacing.three,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ownNote: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});

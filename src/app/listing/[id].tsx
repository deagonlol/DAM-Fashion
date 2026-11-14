import * as Linking from 'expo-linking';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { TopBadge } from '@/components/badge-row';
import { Button } from '@/components/button';
import { ListingCard } from '@/components/listing-card';
import { PhotoCarousel } from '@/components/photo-carousel';
import { PickupSpotList } from '@/components/pickup-spots';
import { QuickMessage } from '@/components/quick-message';
import { ReviewCard } from '@/components/review-card';
import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useBrowseListings } from '@/hooks/use-browse';
import { useListing } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useSales } from '@/hooks/use-sales';
import { useListingReviews } from '@/hooks/use-reviews';
import { useCurrentUser } from '@/hooks/use-session';
import { useShelves } from '@/hooks/use-shelves';
import { useTheme } from '@/hooks/use-theme';
import { useUser, useUserStats } from '@/hooks/use-users';
import { EMPTY_FILTERS, replacementValueFor, similarListings } from '@/lib/data/listings';
import { bookedDays, toDateString } from '@/lib/data/rentals';
import { formatDay, formatPrice, formatPricePerDay } from '@/lib/format';

const REVIEWS_SHOWN = 3;
const SIMILAR_SHOWN = 4;

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const listing = useListing(id);
  const owner = useUser(listing?.ownerId);
  const ownerStats = useUserStats(listing?.ownerId ?? '');
  const currentUser = useCurrentUser();
  const rentals = useRentals();
  const sales = useSales();
  const reviews = useListingReviews(id);
  const browsable = useBrowseListings(EMPTY_FILTERS, 'Newest');
  const theme = useTheme();
  const shelves = useShelves();
  const onShelves = shelves.filter((shelf) => shelf.listingIds.includes(id)).length;
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
  const myOpenBuy = useMemo(
    () => sales.find((sale) => sale.listingId === id && sale.buyerId === currentUser.id && sale.status === 'requested'),
    [sales, id, currentUser.id]
  );
  const incomingBuys = useMemo(
    () => sales.filter((sale) => sale.listingId === id && sale.status === 'requested'),
    [sales, id]
  );
  const bookedDates = useMemo(() => bookedDays(rentals, id), [rentals, id]);
  const similar = useMemo(
    () => (listing ? similarListings(listing, browsable, SIMILAR_SHOWN) : []),
    [listing, browsable]
  );

  if (!listing) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  const isOwnListing = listing.ownerId === currentUser.id;

  async function shareListing() {
    if (!listing) return;
    setError(null);
    try {
      const url = Linking.createURL(`/listing/${listing.id}`);
      await Share.share({ message: `${listing.title} on Lendr: ${url}` });
    } catch {
      setError('Sharing isn’t available here.');
    }
  }

  function renderActions() {
    if (!listing) return null;
    if (isOwnListing) {
      return (
        <>
          {incomingRequests.length > 0 ? (
            <Button
              title={`${incomingRequests.length} borrow request${incomingRequests.length === 1 ? '' : 's'}`}
              onPress={() => router.push(`/rental/${incomingRequests[0].id}`)}
            />
          ) : null}
          {incomingBuys.length > 0 ? (
            <Button
              title={`${incomingBuys.length} buy request${incomingBuys.length === 1 ? '' : 's'}`}
              onPress={() => router.push(`/sale/${incomingBuys[0].id}`)}
            />
          ) : null}
          <Button title="Edit listing" variant="secondary" onPress={() => router.push(`/edit-listing/${listing.id}`)} />
          {listing.paused ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Paused: hidden from browse. Turn it back on in Edit listing.
            </ThemedText>
          ) : null}
        </>
      );
    }
    if (listing.soldAt && !myOpenBorrow) {
      return (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          This item has been sold.
        </ThemedText>
      );
    }
    if (listing.paused && !myOpenBorrow) {
      return (
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          Not available to borrow right now.
        </ThemedText>
      );
    }
    const canBuy = listing.salePrice != null && !listing.soldAt;
    return (
      <>
        {canBuy ? (
          myOpenBuy ? (
            <Button title="View your buy request" onPress={() => router.push(`/sale/${myOpenBuy.id}`)} />
          ) : (
            <Button
              title={`Buy for ${formatPrice(listing.salePrice!)}`}
              onPress={() => router.push(`/buy/${listing.id}`)}
            />
          )
        ) : null}
        {myOpenBorrow ? (
          <Button
            title="View your borrow"
            variant={canBuy ? 'outline' : 'primary'}
            onPress={() => router.push(`/rental/${myOpenBorrow.id}`)}
          />
        ) : listing.rentable !== false ? (
          <Button
            title="Rent"
            variant={canBuy ? 'outline' : 'primary'}
            onPress={() => router.push(`/request/${listing.id}`)}
          />
        ) : null}
      </>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <PhotoCarousel uris={listing.imageUris} label={listing.title} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.title, styles.flex]}>{listing.title}</ThemedText>
            <ThemedText style={styles.price}>
              {listing.rentable === false
                ? formatPrice(listing.salePrice ?? 0)
                : formatPricePerDay(listing.pricePerDay)}
            </ThemedText>
          </View>
          <View style={styles.metaRow}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
              {listing.rentable !== false && listing.salePrice != null && !listing.soldAt
                ? `or ${formatPrice(listing.salePrice)} to buy`
                : listing.soldAt
                  ? 'Sold'
                  : ''}
            </ThemedText>
            <Pressable
              onPress={shareListing}
              accessibilityRole="button"
              accessibilityLabel="Share listing"
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}>
              <SymbolView
                name={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }}
                tintColor={theme.text}
                size={22}
              />
            </Pressable>
            <SaveButton listingId={listing.id} variant="inline" />
            <Pressable
              onPress={() => router.push(`/add-to-shelf/${listing.id}`)}
              accessibilityRole="button"
              accessibilityLabel={onShelves > 0 ? `On ${onShelves} of your shelves. Change shelves` : 'Add to shelf'}
              hitSlop={8}
              style={({ pressed }) => [styles.shelfButton, { borderColor: theme.border }, pressed && styles.pressed]}>
              <ThemedText type="smallBold" style={{ color: onShelves > 0 ? theme.accent : theme.text }}>
                {onShelves > 0 ? `On ${onShelves} shelf${onShelves === 1 ? '' : 'ves'}` : '+ Shelf'}
              </ThemedText>
            </Pressable>
          </View>
          {!listing.soldAt && listing.rentable !== false ? (
            <ThemedText type="small" themeColor="textSecondary">
              Missing-item fee: {formatPrice(replacementValueFor(listing))}
            </ThemedText>
          ) : null}

          <View style={styles.actions}>{renderActions()}</View>
          {/* One line instead of a second calendar: dates get picked on the Rent screen. */}
          {!listing.soldAt && listing.rentable !== false && !listing.paused ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {availabilityLine(bookedDates, new Set(listing.blockedDates ?? []))}
            </ThemedText>
          ) : null}
          {/* Pre-filled instead of a "Message" button: one tap sends it. */}
          {!isOwnListing && !listing.soldAt ? (
            <QuickMessage listingId={listing.id} name={owner?.name.split(' ')[0]} />
          ) : null}
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}

          <View style={[styles.details, { borderColor: theme.border }]}>
            <DetailItem label="Size" value={listing.size} />
            <DetailItem label="Type" value={listing.category} />
            {listing.brand ? <DetailItem label="Brand" value={listing.brand} /> : null}
          </View>

          {listing.events.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Good for</ThemedText>
              <View style={styles.tags}>
                {listing.events.map((event) => (
                  <Pressable
                    key={event}
                    onPress={() => router.push({ pathname: '/search', params: { event } })}
                    accessibilityRole="link"
                    accessibilityLabel={`More ${event} outfits`}
                    style={({ pressed }) => [styles.tag, { borderColor: theme.border }, pressed && styles.pressed]}>
                    <ThemedText type="small">{event}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {listing.description ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Description</ThemedText>
              <ThemedText>{listing.description}</ThemedText>
            </View>
          ) : null}

          {listing.measurements || listing.fitNote ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Fit</ThemedText>
              {listing.measurements ? <ThemedText>{listing.measurements}</ThemedText> : null}
              {listing.fitNote ? <ThemedText themeColor="textSecondary">{listing.fitNote}</ThemedText> : null}
            </View>
          ) : null}

          {listing.pickupSpots?.length ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Pickup spots</ThemedText>
              <PickupSpotList spots={listing.pickupSpots} />
            </View>
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
        </View>

        {similar.length > 0 ? (
          <View style={[styles.similar, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Similar items</ThemedText>
            <View style={styles.grid}>
              {similar.map((item) => (
                <View key={item.id} style={styles.cell}>
                  <ListingCard listing={item} />
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

/** "Available today", or the next day it's free, from the days already booked or blocked. */
function availabilityLine(booked: Set<string>, blocked: Set<string>) {
  const day = new Date();
  for (let i = 0; i < 90; i++) {
    const date = toDateString(day);
    if (!booked.has(date) && !blocked.has(date)) {
      return i === 0 ? 'Available today · pick dates when you tap Rent' : `Next free: ${formatDay(date)}`;
    }
    day.setDate(day.getDate() + 1);
  }
  return 'Booked for the next few months';
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  details: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.three,
  },
  detailItem: {
    flex: 1,
    gap: Spacing.half,
  },
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
    paddingBottom: Spacing.five,
  },
  body: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  price: {
    fontFamily: Fonts.bodySemiBold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: -Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  shelfButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  center: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  nameRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  reportLink: {
    alignSelf: 'flex-start',
  },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pressed: {
    opacity: 0.6,
  },
  reviews: {
    gap: Spacing.three,
  },
  similar: {
    marginTop: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  cell: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '50%',
  },
});

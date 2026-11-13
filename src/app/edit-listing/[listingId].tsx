import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { Button } from '@/components/button';
import { ListingForm } from '@/components/listing-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteListing, setListingPaused, toggleBlockedDate, updateListing } from '@/lib/data/listings';
import { bookedDays } from '@/lib/data/rentals';

/**
 * Everything about your own listing in one place: photos and details, availability, and delete.
 * Requests and borrows live in Orders and Inbox, not here.
 */
export default function EditListingScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);
  const user = useCurrentUser();
  const rentals = useRentals();
  const theme = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bookedDates = useMemo(() => bookedDays(rentals, listingId), [rentals, listingId]);

  if (!listing || listing.ownerId !== user.id) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  async function handleDelete() {
    if (!listing) return;
    // Two taps instead of a dialog, so it works the same on web.
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setError(null);
    try {
      await deleteListing(listing.id);
      router.dismissTo('/closet');
    } catch (e) {
      setConfirmingDelete(false);
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  const {
    imageUris,
    title,
    description,
    category,
    events,
    size,
    brand,
    measurements,
    fitNote,
    pickupSpots,
    pricePerDay,
    salePrice,
    rentable,
  } = listing;

  return (
    <ListingForm
      initial={{
        imageUris,
        title,
        description,
        category,
        events,
        size,
        brand,
        measurements,
        fitNote,
        pickupSpots,
        pricePerDay,
        salePrice,
        rentable,
      }}
      excludeId={listing.id}
      submitLabel="Save changes"
      onSubmit={async (values) => {
        await updateListing(listing.id, values);
        router.back();
      }}
      footer={
        <View style={[styles.deleteZone, { borderColor: theme.border }]}>
          <Button
            title={confirmingDelete ? 'Tap again to delete for good' : 'Delete listing'}
            variant={confirmingDelete ? 'dangerFilled' : 'danger'}
            onPress={handleDelete}
          />
          {confirmingDelete ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              Pending requests will be declined. This can’t be undone.
            </ThemedText>
          ) : null}
        </View>
      }>
      {listing.rentable !== false ? (
        <View style={styles.section}>
          <ThemedText type="smallBold">Availability</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Open to borrow</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {listing.paused
                  ? 'Paused: hidden from browsing and can’t be requested.'
                  : 'Showing in browse and search.'}
              </ThemedText>
            </View>
            <Switch
              value={!listing.paused}
              onValueChange={(available) => run(() => setListingPaused(listing.id, !available))}
              trackColor={{ true: theme.accent, false: theme.border }}
              thumbColor={theme.background}
              accessibilityLabel="Open to borrow"
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Tap days you’re not lending it (like when you’re wearing it). Booked days come from accepted borrows. These
            save right away.
          </ThemedText>
          <AvailabilityCalendar
            bookedDates={bookedDates}
            blockedDates={new Set(listing.blockedDates ?? [])}
            onToggleDay={(date) => run(() => toggleBlockedDate(listing.id, date))}
          />
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </ListingForm>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: 12,
    padding: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  deleteZone: {
    gap: Spacing.two,
    marginTop: Spacing.three,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: {
    textAlign: 'center',
  },
});

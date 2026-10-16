import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { Button } from '@/components/button';
import { RentalRow } from '@/components/rental-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { deleteListing, setListingPaused, toggleBlockedDate } from '@/lib/data/listings';
import { toDateString } from '@/lib/data/rentals';

/** Owner tools for one listing: availability calendar, pause, edit, delete, and its borrows. */
export default function ManageListingScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);
  const user = useCurrentUser();
  const rentals = useRentals();
  const theme = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const forListing = useMemo(() => rentals.filter((rental) => rental.listingId === listingId), [rentals, listingId]);
  const bookedDates = useMemo(() => {
    const dates = new Set<string>();
    for (const rental of forListing) {
      if (rental.status !== 'accepted' && rental.status !== 'picked_up') continue;
      const day = new Date(`${rental.startDate}T00:00:00`);
      const end = new Date(`${rental.endDate}T00:00:00`);
      while (day <= end) {
        dates.add(toDateString(day));
        day.setDate(day.getDate() + 1);
      }
    }
    return dates;
  }, [forListing]);
  const openBorrows = forListing
    .filter((rental) => ['requested', 'accepted', 'picked_up'].includes(rental.status))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

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
      router.dismissTo('/profile');
    } catch (e) {
      setConfirmingDelete(false);
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: listing.title }} />
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <ThemedText type="smallBold">Available to borrow</ThemedText>
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
              accessibilityLabel="Available to borrow"
            />
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText type="smallBold">Availability</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Tap days you’re not lending it (like when you’re wearing it). Booked days come from accepted borrows.
          </ThemedText>
          <AvailabilityCalendar
            bookedDates={bookedDates}
            blockedDates={new Set(listing.blockedDates ?? [])}
            onToggleDay={(date) => run(() => toggleBlockedDate(listing.id, date))}
          />
        </View>

        {openBorrows.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="smallBold">Requests and borrows</ThemedText>
            {openBorrows.map((rental) => (
              <RentalRow
                key={rental.id}
                item={{
                  rental,
                  role: 'lender',
                  needsAction: rental.status === 'requested' ? 'Respond to request' : null,
                  priority: 0,
                }}
              />
            ))}
          </View>
        ) : null}

        {error ? (
          <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
            {error}
          </ThemedText>
        ) : null}

        <Button title="Edit details and photos" variant="secondary" onPress={() => router.push(`/edit-listing/${listing.id}`)} />
        <Button
          title={confirmingDelete ? 'Tap again to delete for good' : 'Delete listing'}
          variant="secondary"
          onPress={handleDelete}
        />
        {confirmingDelete ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Pending requests will be declined. This can’t be undone.
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
    gap: Spacing.four,
  },
  flex: {
    flex: 1,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
});

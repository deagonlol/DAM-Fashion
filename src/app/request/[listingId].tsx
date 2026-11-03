import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Chip, ChipGroup } from '@/components/chip-group';
import { RestrictionBanner } from '@/components/restriction-banner';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { openOfferCount, rangesOverlap, requestBorrow, toDateString } from '@/lib/data/rentals';
import { PICKUP_SPOTS, type PickupSpot } from '@/lib/data/types';
import { formatDay, formatPrice } from '@/lib/format';

const DAYS_AHEAD = 21;
const DURATIONS = [1, 2, 3, 5, 7];

function addDays(date: string, days: number) {
  const result = new Date(`${date}T00:00:00`);
  result.setDate(result.getDate() + days);
  return toDateString(result);
}

function dayLabel(date: string, index: number) {
  if (index === 0) return 'Today';
  if (index === 1) return 'Tomorrow';
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'numeric', day: 'numeric' });
}

/** Pick dates and a pickup spot, then send a borrow request to the lender. */
export default function RequestBorrowScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);
  const rentals = useRentals();
  const user = useCurrentUser();
  const theme = useTheme();
  const [today] = useState(() => toDateString(new Date()));
  const [startDate, setStartDate] = useState<string | null>(null);
  const [days, setDays] = useState(1);
  const [pickupSpot, setPickupSpot] = useState<PickupSpot | null>(null);
  const [message, setMessage] = useState('');
  const [offer, setOffer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dates other borrowers already hold (accepted or out), which can't be requested.
  const booked = useMemo(
    () =>
      rentals.filter(
        (rental) =>
          rental.listingId === listingId && (rental.status === 'accepted' || rental.status === 'picked_up')
      ),
    [rentals, listingId]
  );
  const ownerBlocked = listing?.blockedDates ?? [];
  const isFree = (start: string, end: string) =>
    !booked.some((rental) => rangesOverlap(rental.startDate, rental.endDate, start, end)) &&
    !ownerBlocked.some((date) => date >= start && date <= end);

  const dates = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today]);

  if (!listing) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  const endDate = startDate ? addDays(startDate, days - 1) : null;
  const offerText = offer || (listing ? String(listing.pricePerDay) : '');
  const offeredPricePerDay = Number(offerText);
  const offerOk = Number.isFinite(offeredPricePerDay) && listing !== undefined && offeredPricePerDay >= listing.pricePerDay;
  const competing =
    listing && startDate && endDate ? openOfferCount(rentals, listing.id, startDate, endDate, user.id) : 0;
  const canSubmit = startDate !== null && endDate !== null && pickupSpot !== null && offerOk && !submitting;

  async function handleSubmit() {
    if (!startDate || !endDate || !pickupSpot || !listing) return;
    setError(null);
    setSubmitting(true);
    try {
      const rental = await requestBorrow({
        listingId: listing.id,
        startDate,
        endDate,
        pickupSpot,
        message,
        offeredPricePerDay,
      });
      router.replace(`/rental/${rental.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Request to borrow' }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <ThemedText type="subtitle">{listing.title}</ThemedText>
          <RestrictionBanner />

          <View style={styles.section}>
            <ThemedText type="smallBold">Pickup day</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {dates.map((date, index) => (
                <Chip
                  key={date}
                  label={dayLabel(date, index)}
                  selected={date === startDate}
                  disabled={!isFree(date, date)}
                  onPress={() => {
                    setStartDate(date);
                    // Shorten the borrow if the chosen length would run into a booked day.
                    if (!isFree(date, addDays(date, days - 1))) setDays(1);
                  }}
                />
              ))}
            </ScrollView>
            {booked.length > 0 || ownerBlocked.length > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                Greyed-out days are booked or unavailable.
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">How long</ThemedText>
            <View style={styles.wrap}>
              {DURATIONS.map((length) => (
                <Chip
                  key={length}
                  label={length === 1 ? '1 day' : `${length} days`}
                  selected={length === days}
                  disabled={startDate !== null && !isFree(startDate, addDays(startDate, length - 1))}
                  onPress={() => setDays(length)}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Pickup spot</ThemedText>
            <ChipGroup options={PICKUP_SPOTS} value={pickupSpot} onChange={setPickupSpot} />
          </View>

          <TextField
            label="Your offer per day ($)"
            value={offerText}
            onChangeText={setOffer}
            keyboardType="decimal-pad"
          />
          <ThemedText type="small" themeColor={offer !== '' && !offerOk ? 'danger' : 'textSecondary'}>
            {competing > 0
              ? `${competing} ${competing === 1 ? 'other person wants' : 'other people want'} some of these dates. Offer at least ${formatPrice(listing.pricePerDay)}/day.`
              : `The listed price is ${formatPrice(listing.pricePerDay)}/day. You can offer more.`}
          </ThemedText>

          <TextField
            label="Message (optional)"
            value={message}
            onChangeText={setMessage}
            placeholder="What's the occasion? Any questions about fit?"
            multiline
          />

          {startDate && endDate ? (
            <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">
                Pick up {formatDay(startDate)} · Return by {formatDay(endDate)}
              </ThemedText>
              <ThemedText type="smallBold">
                {formatPrice(offeredPricePerDay * days)} total ({days} × {formatPrice(offeredPricePerDay)})
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                In-app payment is coming soon. For now, settle up at pickup.
              </ThemedText>
            </View>
          ) : null}

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button title="Send request" disabled={!canSubmit} onPress={handleSubmit} />
        </SafeAreaView>
      </KeyboardAvoidingView>
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
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  summary: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

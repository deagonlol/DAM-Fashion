import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { RestrictionBanner } from '@/components/restriction-banner';
import { TextField } from '@/components/text-field';
import { TimePicker } from '@/components/time-picker';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import {
  bookedDays,
  MAX_RENTAL_DAYS,
  MEETING_TIMES,
  openOfferCount,
  pickRange,
  rangesOverlap,
  rentalDays,
  requestBorrow,
  toDateString,
  type DateRange,
} from '@/lib/data/rentals';
import { PICKUP_SPOTS, type PickupSpot } from '@/lib/data/types';
import { formatDay, formatPrice, formatPricePerDay, formatTime } from '@/lib/format';

/** Pick dates on the calendar, a pickup spot and times, then send a borrow request to the lender. */
export default function RequestBorrowScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);
  const rentals = useRentals();
  const user = useCurrentUser();
  const theme = useTheme();
  const [range, setRange] = useState<DateRange | null>(null);
  const [pickupSpot, setPickupSpot] = useState<PickupSpot | null>(null);
  const [pickupTime, setPickupTime] = useState<string | null>(null);
  const [returnTime, setReturnTime] = useState<string | null>(null);
  const now = useNow();
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
  const bookedDates = useMemo(() => bookedDays(rentals, listingId), [rentals, listingId]);

  if (!listing) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  const startDate = range?.startDate ?? null;
  const endDate = range?.endDate ?? null;
  const days = range ? rentalDays(range.startDate, range.endDate) : 0;
  const offerText = offer || (listing ? String(listing.pricePerDay) : '');
  const offeredPricePerDay = Number(offerText);
  const offerOk = Number.isFinite(offeredPricePerDay) && listing !== undefined && offeredPricePerDay >= listing.pricePerDay;
  const competing =
    listing && startDate && endDate ? openOfferCount(rentals, listing.id, startDate, endDate, user.id) : 0;
  // Times that have already passed today can't be picked.
  const today = toDateString(now);
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pickupPast = (time: string) => startDate === today && time <= nowTime;
  const sameDay = startDate !== null && startDate === endDate;
  const returnTooEarly = (time: string) => sameDay && pickupTime !== null && time <= pickupTime;
  const timesOk =
    pickupTime !== null && returnTime !== null && !pickupPast(pickupTime) && !returnTooEarly(returnTime);
  const canSubmit =
    startDate !== null && endDate !== null && pickupSpot !== null && timesOk && offerOk && !submitting;

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
        pickupTime: pickupTime ?? undefined,
        returnTime: returnTime ?? undefined,
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
      <Stack.Screen options={{ title: 'Rent' }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.item}>
            <Image
              source={listing.imageUris[0]}
              style={[styles.photo, { backgroundColor: theme.backgroundElement }]}
              contentFit="cover"
            />
            <View style={styles.itemInfo}>
              <ThemedText type="smallBold" numberOfLines={2}>
                {listing.title}
              </ThemedText>
              <ThemedText style={styles.price}>{formatPricePerDay(listing.pricePerDay)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Size {listing.size}
                {listing.brand ? ` · ${listing.brand}` : ''} · {listing.category}
              </ThemedText>
            </View>
          </View>
          <RestrictionBanner />

          <View style={styles.section}>
            <ThemedText style={styles.heading}>Select dates</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {!range
                ? 'Tap your pickup day.'
                : range.startDate === range.endDate
                  ? `Tap your return day, or keep it to one day. Up to ${MAX_RENTAL_DAYS} days.`
                  : `Pick up ${formatDay(range.startDate)} · Return by ${formatDay(range.endDate)}`}
            </ThemedText>
            <AvailabilityCalendar
              bookedDates={bookedDates}
              blockedDates={new Set(ownerBlocked)}
              selected={range}
              onSelectDay={(date) => setRange((current) => pickRange(current, date, isFree))}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Pickup spot</ThemedText>
            <ChipGroup
              options={listing.pickupSpots?.length ? listing.pickupSpots : PICKUP_SPOTS}
              value={pickupSpot}
              onChange={setPickupSpot}
            />
            {listing.pickupSpots?.length ? (
              <ThemedText type="small" themeColor="textSecondary">
                The lender meets at these spots.
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.section}>
            <TimePicker
              label={startDate ? `Pickup time · ${formatDay(startDate)}` : 'Pickup time'}
              times={MEETING_TIMES}
              value={pickupTime}
              onChange={setPickupTime}
              isDisabled={pickupPast}
            />
            <TimePicker
              label={endDate ? `Return time · ${formatDay(endDate)}` : 'Return time'}
              times={MEETING_TIMES}
              value={returnTime}
              onChange={setReturnTime}
              isDisabled={returnTooEarly}
            />
            {pickupTime && returnTime && returnTooEarly(returnTime) ? (
              <ThemedText type="small" themeColor="danger">
                For a one-day borrow, return after the {formatTime(pickupTime)} pickup.
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Austin time. You can change plans with the lender in chat.
              </ThemedText>
            )}
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

          <View style={[styles.summary, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.totalRow}>
              <View style={styles.flex}>
                <ThemedText style={styles.heading}>Total cost</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {range
                    ? `${formatPrice(offerOk ? offeredPricePerDay : listing.pricePerDay)}/day × ${days} ${days === 1 ? 'day' : 'days'}`
                    : 'Price per day × days renting'}
                </ThemedText>
              </View>
              <ThemedText style={styles.total}>
                {range ? formatPrice((offerOk ? offeredPricePerDay : listing.pricePerDay) * days) : '$'}
              </ThemedText>
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              In-app payment is coming soon. For now, settle up at pickup.
            </ThemedText>
          </View>

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
  flex: {
    flex: 1,
  },
  section: {
    gap: Spacing.two,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  photo: {
    width: 88,
    height: 88,
    borderRadius: 16,
  },
  itemInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  price: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    lineHeight: 26,
  },
  heading: {
    fontFamily: Fonts.heading,
    fontSize: 18,
    lineHeight: 24,
  },
  summary: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  total: {
    fontFamily: Fonts.heading,
    fontSize: 24,
    lineHeight: 30,
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

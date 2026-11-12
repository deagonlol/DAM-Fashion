import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvailabilityCalendar } from '@/components/availability-calendar';
import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { TimePicker } from '@/components/time-picker';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useRental, useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { timesForDate } from '@/lib/data/availability';
import { changedTerms, proposalKind, proposeChange, termsOf, type BorrowTerms } from '@/lib/data/proposals';
import {
  MAX_RENTAL_DAYS,
  pickRange,
  rangesOverlap,
  rentalDays,
  toDateString,
  type DateRange,
} from '@/lib/data/rentals';
import { PICKUP_SPOTS, type PickupSpot } from '@/lib/data/types';
import { formatDay, formatPrice, formatTime } from '@/lib/format';

const TITLES = { edit: 'Edit request', counter: 'Counter-offer', change: 'Change plans' } as const;

/**
 * Propose different terms for a borrow, prefilled with the current ones: the borrower edits their
 * waiting request, the lender counters it, or either person changes the plans of a confirmed borrow.
 */
export default function ProposeScreen() {
  const { rentalId } = useLocalSearchParams<{ rentalId: string }>();
  const rental = useRental(rentalId);
  const listing = useListing(rental?.listingId);
  const user = useCurrentUser();
  const rentals = useRentals();
  const theme = useTheme();
  const now = useNow();
  const other = useUser(rental?.borrowerId === user.id ? rental?.lenderId : rental?.borrowerId);
  const lender = useUser(rental?.lenderId);
  const current = rental && listing ? termsOf(rental, listing.pricePerDay) : null;
  const [range, setRange] = useState<DateRange | null>(
    current ? { startDate: current.startDate, endDate: current.endDate } : null
  );
  const [spot, setSpot] = useState<PickupSpot | null>(current?.pickupSpot ?? null);
  const [pickupTime, setPickupTime] = useState<string | null>(current?.pickupTime ?? null);
  const [returnTime, setReturnTime] = useState<string | null>(current?.returnTime ?? null);
  const [price, setPrice] = useState(current ? String(current.pricePerDay) : '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Other borrows already holding dates. This one's own dates stay pickable.
  const booked = useMemo(
    () =>
      rentals.filter(
        (held) =>
          held.id !== rentalId &&
          held.listingId === rental?.listingId &&
          (held.status === 'accepted' || held.status === 'picked_up')
      ),
    [rentals, rentalId, rental?.listingId]
  );

  const kind = rental ? proposalKind(rental, user.id) : null;
  if (!rental || !listing || !current || !kind) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">This borrow can’t be changed anymore.</ThemedText>
      </ThemedView>
    );
  }

  const isLender = rental.lenderId === user.id;
  const ownerBlocked = isLender ? [] : (listing.blockedDates ?? []);
  const bookedDates = new Set(
    booked.flatMap((held) => {
      const heldDays: string[] = [];
      for (
        let d = new Date(`${held.startDate}T00:00:00`);
        toDateString(d) <= held.endDate;
        d.setDate(d.getDate() + 1)
      ) {
        heldDays.push(toDateString(d));
      }
      return heldDays;
    })
  );
  const isFree = (start: string, end: string) =>
    !booked.some((held) => rangesOverlap(held.startDate, held.endDate, start, end)) &&
    !ownerBlocked.some((date) => date >= start && date <= end);

  // The price is settled once a borrow is confirmed; lenders can go below their listed price.
  const priceEditable = kind !== 'change';
  const perDay = priceEditable ? Number(price) : current.pricePerDay;
  const priceOk = Number.isFinite(perDay) && perDay >= 0 && (isLender || perDay >= listing.pricePerDay);

  const today = toDateString(now);
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const pickupPast = (time: string) => range?.startDate === today && time <= nowTime;
  const returnTooEarly = (time: string) =>
    range !== null && range.startDate === range.endDate && pickupTime !== null && time <= pickupTime;

  // Only times the lender is usually free. The lender can pick any time themselves.
  const windows = isLender ? undefined : lender?.pickupWindows;
  const pickupTimes = timesForDate(windows, range?.startDate ?? null);
  const returnTimes = timesForDate(windows, range?.endDate ?? null);

  const proposed: BorrowTerms | null =
    range && spot && pickupTime && returnTime
      ? {
          startDate: range.startDate,
          endDate: range.endDate,
          pickupTime,
          returnTime,
          pickupSpot: spot,
          pricePerDay: perDay,
        }
      : null;
  const changes = proposed ? changedTerms(current, proposed) : [];
  const canSubmit =
    proposed !== null &&
    changes.length > 0 &&
    priceOk &&
    pickupTimes.includes(proposed.pickupTime!) &&
    returnTimes.includes(proposed.returnTime!) &&
    !pickupPast(proposed.pickupTime!) &&
    !returnTooEarly(proposed.returnTime!) &&
    !submitting;
  const days = range ? rentalDays(range.startDate, range.endDate) : 0;
  const firstName = other?.name.split(' ')[0] ?? (isLender ? 'the borrower' : 'the lender');

  async function handleSubmit() {
    if (!proposed || !rental) return;
    setError(null);
    setSubmitting(true);
    try {
      await proposeChange(rental, user.id, proposed, note);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: TITLES[kind] }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText themeColor="textSecondary">
            {kind === 'edit'
              ? `${firstName} hasn’t answered yet, so your changes apply right away.`
              : kind === 'counter'
                ? `Suggest different terms. If ${firstName} accepts, the borrow is confirmed.`
                : `Suggest new plans. If ${firstName} declines, the current plans stay.`}
          </ThemedText>

          <View style={styles.section}>
            <ThemedText type="smallBold">Dates</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {range
                ? range.startDate === range.endDate
                  ? `${formatDay(range.startDate)}. Tap a later day to extend, up to ${MAX_RENTAL_DAYS} days.`
                  : `Pick up ${formatDay(range.startDate)} · Return by ${formatDay(range.endDate)}`
                : 'Tap the pickup day.'}
            </ThemedText>
            <AvailabilityCalendar
              bookedDates={bookedDates}
              blockedDates={new Set(ownerBlocked)}
              selected={range}
              onSelectDay={(date) => setRange((value) => pickRange(value, date, isFree))}
            />
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">Pickup spot</ThemedText>
            <ChipGroup
              options={listing.pickupSpots?.length ? listing.pickupSpots : PICKUP_SPOTS}
              value={spot}
              onChange={setSpot}
            />
          </View>

          <View style={styles.section}>
            <TimePicker
              label={range ? `Pickup time · ${formatDay(range.startDate)}` : 'Pickup time'}
              times={pickupTimes}
              value={pickupTime}
              onChange={setPickupTime}
              isDisabled={pickupPast}
            />
            <TimePicker
              label={range ? `Return time · ${formatDay(range.endDate)}` : 'Return time'}
              times={returnTimes}
              value={returnTime}
              onChange={setReturnTime}
              isDisabled={returnTooEarly}
            />
          </View>

          {priceEditable ? (
            <View style={styles.section}>
              <TextField label="Price per day ($)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
              <ThemedText type="small" themeColor={price !== '' && !priceOk ? 'danger' : 'textSecondary'}>
                {isLender
                  ? `Your listed price is ${formatPrice(listing.pricePerDay)}/day. You can go lower.`
                  : `At least the listed ${formatPrice(listing.pricePerDay)}/day.`}
                {range && priceOk
                  ? ` Total: ${formatPrice(perDay * days)} for ${days} ${days === 1 ? 'day' : 'days'}.`
                  : ''}
              </ThemedText>
            </View>
          ) : null}

          {kind !== 'edit' ? (
            <TextField
              label="Note (optional)"
              value={note}
              onChangeText={setNote}
              placeholder={kind === 'counter' ? 'e.g. I have class until 4' : 'e.g. Can we push it a day?'}
              maxLength={300}
              multiline
            />
          ) : null}

          {proposed && changes.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Change something to send it.
            </ThemedText>
          ) : null}
          {proposed && pickupTime && returnTime && changes.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              New plan: pick up {formatDay(proposed.startDate)} at {formatTime(pickupTime)}, return{' '}
              {formatDay(proposed.endDate)} at {formatTime(returnTime)}, at {proposed.pickupSpot}.
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button
            title={kind === 'edit' ? 'Save changes' : kind === 'counter' ? 'Send counter-offer' : 'Propose new plans'}
            onPress={handleSubmit}
            disabled={!canSubmit}
          />
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
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

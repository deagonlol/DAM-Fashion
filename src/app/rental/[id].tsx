import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { STATUS_LABELS } from '@/components/rental-row';
import { ReviewCard } from '@/components/review-card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useRental } from '@/hooks/use-rentals';
import { useAllReviews, useRentalReviews } from '@/hooks/use-reviews';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { getOrCreateConversation } from '@/lib/data/messages';
import {
  acceptRequest,
  cancelBorrow,
  canReportIssue,
  canReportNoShow,
  daysOverdue,
  declineRequest,
  formatRemainingTime,
  ISSUE_REPORT_WINDOW_HOURS,
  rentalDays,
  reportConditionIssue,
  reportMissedPickup,
  submitPickupCode,
  submitReturnCode,
} from '@/lib/data/rentals';
import { canReview, isReviewVisible, reviewDaysLeft } from '@/lib/data/reviews';
import type { Rental, RentalStatus } from '@/lib/data/types';
import { formatDay, formatPrice, formatTime } from '@/lib/format';

const STEPS: { status: RentalStatus; label: string }[] = [
  { status: 'requested', label: 'Requested' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'picked_up', label: 'Picked up' },
  { status: 'returned', label: 'Returned' },
];

/** One borrow from request to review, with the actions each person can take at each step. */
export default function RentalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const rental = useRental(id);
  const listing = useListing(rental?.listingId);
  const user = useCurrentUser();
  const now = useNow();
  const theme = useTheme();
  const role = rental?.borrowerId === user.id ? 'borrower' : rental?.lenderId === user.id ? 'lender' : null;
  const other = useUser(role === 'borrower' ? rental?.lenderId : rental?.borrowerId);
  const allReviews = useAllReviews();
  const rentalReviews = useRentalReviews(rental?.id);
  const [code, setCode] = useState('');
  const [issue, setIssue] = useState('');
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!rental || !role) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Borrow not found.</ThemedText>
      </ThemedView>
    );
  }

  const otherName = other?.name ?? (role === 'borrower' ? 'the lender' : 'the borrower');
  const firstName = otherName.split(' ')[0];
  const dailyPrice = rental.offeredPricePerDay ?? listing?.pricePerDay;
  const total = dailyPrice != null ? dailyPrice * rentalDays(rental.startDate, rental.endDate) : null;
  const late = daysOverdue(rental, now);
  const myReview = rentalReviews.find((review) => review.reviewerId === user.id);
  const visibleReviews = rentalReviews.filter((review) => isReviewVisible(review, allReviews, [rental], now));

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  async function openChat() {
    if (!rental) return;
    await run(async () => {
      const conversation = await getOrCreateConversation(rental.listingId, rental.borrowerId);
      router.push(`/chat/${conversation.id}`);
    });
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: STATUS_LABELS[rental.status] }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
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
                <View style={styles.itemTitleRow}>
                  <ThemedText type="smallBold" style={styles.flex} numberOfLines={1}>
                    {listing.title}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {listing.size} · {listing.category}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {role === 'borrower' ? 'You’re borrowing' : 'You’re lending'}
                </ThemedText>
              </View>
            </Pressable>
          ) : null}

          <Steps status={rental.status} />

          <Card>
            <Detail
              label="Pick up"
              value={`${formatDay(rental.startDate)}${rental.pickupTime ? `, ${formatTime(rental.pickupTime)}` : ''}`}
            />
            <Detail
              label="Return by"
              value={`${formatDay(rental.endDate)}${rental.returnTime ? `, ${formatTime(rental.returnTime)}` : ''}`}
            />
            <Detail label="Where" value={rental.pickupSpot} />
            {total !== null ? <Detail label="Total" value={formatPrice(total)} /> : null}
            <Pressable
              onPress={() => router.push(`/user/${other?.id ?? ''}`)}
              accessibilityRole="link"
              style={styles.person}>
              <Avatar name={otherName} uri={other?.avatarUrl} size={32} />
              <ThemedText type="small" style={styles.flex}>
                {role === 'borrower' ? 'Lender' : 'Borrower'}: {otherName}
              </ThemedText>
              <ThemedText themeColor="textSecondary">›</ThemedText>
            </Pressable>
          </Card>

          {/* ---- What happens next, by status and role ---- */}

          {rental.status === 'requested' && role === 'lender' ? (
            <Card>
              <ThemedText>
                {firstName} wants to borrow this
                {dailyPrice != null ? ` for ${formatPrice(dailyPrice)}/day` : ''}. Accept to lock in the dates.
              </ThemedText>
              <View style={styles.row}>
                <Button title="Decline" variant="secondary" style={styles.flex} onPress={() => run(() => declineRequest(rental.id))} />
                <Button title="Accept" style={styles.flex} onPress={() => run(() => acceptRequest(rental.id))} />
              </View>
            </Card>
          ) : null}

          {rental.status === 'requested' && role === 'borrower' ? (
            <Card>
              <ThemedText>Waiting for {firstName} to respond.</ThemedText>
              <Button title="Cancel request" variant="secondary" onPress={() => run(() => cancelBorrow(rental.id))} />
            </Card>
          ) : null}

          {rental.status === 'accepted' ? (
            <Card>
              {role === 'lender' ? (
                <>
                  <ThemedText>At pickup, show {firstName} this code. They enter it to confirm the handoff.</ThemedText>
                  <Code value={rental.pickupCode} />
                </>
              ) : (
                <>
                  <ThemedText>
                    At pickup, ask {firstName} for the code on their screen and enter it here.
                  </ThemedText>
                  <CodeEntry value={code} onChange={setCode} onSubmit={() => run(() => submitPickupCode(rental.id, code))} label="Confirm pickup" />
                  <Button title="Cancel borrow" variant="secondary" onPress={() => run(() => cancelBorrow(rental.id))} />
                </>
              )}
              {canReportNoShow(rental, now) ? (
                <Pressable onPress={() => run(() => reportMissedPickup(rental.id))} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="small" themeColor="danger">
                    {firstName} didn’t show up
                  </ThemedText>
                </Pressable>
              ) : null}
            </Card>
          ) : null}

          {rental.status === 'picked_up' ? (
            <Card>
              <ThemedText type={late > 0 ? 'smallBold' : undefined} themeColor={late > 0 ? 'danger' : undefined}>
                {formatRemainingTime(rental, now)}
              </ThemedText>
              {late > 0 ? (
                <ThemedText type="smallBold" themeColor="danger">
                  {role === 'borrower'
                    ? 'Return it as soon as you can. Late fees will apply once payments are live.'
                    : `We’ve reminded ${firstName}.`}
                </ThemedText>
              ) : (
                <ThemedText>Due back {formatDay(rental.endDate)}.</ThemedText>
              )}
              {role === 'borrower' ? (
                <>
                  <ThemedText>When you return it, show {firstName} this code.</ThemedText>
                  <Code value={rental.returnCode} />
                </>
              ) : (
                <>
                  <ThemedText>When it comes back, enter the code on {firstName}’s screen.</ThemedText>
                  <CodeEntry value={code} onChange={setCode} onSubmit={() => run(() => submitReturnCode(rental.id, code))} label="Confirm return" />
                </>
              )}
            </Card>
          ) : null}

          {rental.status === 'returned' ? (
            <Card>
              <ThemedText>Returned. Thanks for keeping it easy!</ThemedText>
              {rental.conditionIssue ? (
                <ThemedText type="small" themeColor="danger">
                  Problem reported: {rental.conditionIssue}
                </ThemedText>
              ) : null}
              {role === 'lender' && canReportIssue(rental, now) ? (
                showIssueForm ? (
                  <>
                    <TextField
                      value={issue}
                      onChangeText={setIssue}
                      placeholder="What was wrong? (stain, damage, missing piece…)"
                      multiline
                    />
                    <Button
                      title="Report problem"
                      variant="secondary"
                      disabled={!issue.trim()}
                      onPress={() => run(() => reportConditionIssue(rental.id, issue))}
                    />
                  </>
                ) : (
                  <Pressable onPress={() => setShowIssueForm(true)} accessibilityRole="button" hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Something wrong with the item? Report it within {ISSUE_REPORT_WINDOW_HOURS} hours.
                    </ThemedText>
                  </Pressable>
                )
              ) : null}

              {canReview(rental, user.id, allReviews, now) ? (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {reviewDaysLeft(rental, now)} days left to review. Reviews stay hidden until you both
                    review.
                  </ThemedText>
                  <Button title={`Review ${firstName}`} onPress={() => router.push(`/review/${rental.id}`)} />
                </>
              ) : myReview && !isReviewVisible(myReview, allReviews, [rental], now) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  You reviewed {firstName}. Your review goes public when they review you, or in{' '}
                  {reviewDaysLeft(rental, now)} days.
                </ThemedText>
              ) : null}
            </Card>
          ) : null}

          {rental.status === 'declined' || rental.status === 'cancelled' || rental.status === 'no_show' ? (
            <Card>
              <ThemedText>{endedMessage(rental, role, user.id, firstName)}</ThemedText>
            </Card>
          ) : null}

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}

          {visibleReviews.length > 0 ? (
            <View style={styles.section}>
              <ThemedText type="smallBold">Reviews</ThemedText>
              {visibleReviews.map((review) => (
                <ReviewCard key={review.id} review={review} canReply={review.revieweeId === user.id && !review.reply} />
              ))}
            </View>
          ) : null}

          <Button title={`Message ${firstName}`} variant="secondary" onPress={openChat} />
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/report/[userId]',
                params: {
                  userId: other?.id ?? '',
                  rentalId: rental.id,
                  ...(rental.status === 'no_show' ? { reason: 'No-show' } : {}),
                },
              })
            }
            accessibilityRole="button"
            style={styles.reportLink}
            hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Report a problem with {firstName}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function endedMessage(rental: Rental, role: 'borrower' | 'lender', userId: string, firstName: string) {
  switch (rental.status) {
    case 'declined':
      return role === 'borrower' ? `${firstName} couldn’t lend it this time.` : 'You declined this request.';
    case 'cancelled':
      return role === 'borrower' ? 'You cancelled this borrow.' : `${firstName} cancelled this borrow.`;
    case 'no_show':
      return rental.noShowReportedBy === userId
        ? `You reported that ${firstName} didn’t show up. Our team will follow up.`
        : `${firstName} reported a missed pickup. If that’s wrong, contact support.`;
    default:
      return '';
  }
}

function Steps({ status }: { status: RentalStatus }) {
  const theme = useTheme();
  const reached = STEPS.findIndex((step) => step.status === status);
  if (reached === -1) return null; // declined / cancelled / no-show: no progress bar
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${reached + 1} of ${STEPS.length}: ${STEPS[reached].label}`}>
      {STEPS.map((step, index) => (
        <View key={step.status} style={styles.step}>
          <View style={[styles.stepBar, { backgroundColor: index <= reached ? theme.accent : theme.border }]} />
          <ThemedText type="small" themeColor={index <= reached ? 'text' : 'textSecondary'}>
            {step.label}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</View>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" style={styles.detailValue}>
        {value}
      </ThemedText>
    </View>
  );
}

function Code({ value }: { value: string | undefined }) {
  const theme = useTheme();
  return (
    <View style={[styles.code, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <ThemedText style={styles.codeText} accessibilityLabel={`Code ${value?.split('').join(' ')}`}>
        {value ?? '----'}
      </ThemedText>
    </View>
  );
}

function CodeEntry({
  value,
  onChange,
  onSubmit,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
  label: string;
}) {
  return (
    <>
      <TextField
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 4))}
        placeholder="4-digit code"
        keyboardType="number-pad"
        maxLength={4}
        style={styles.codeInput}
        accessibilityLabel="Handoff code"
      />
      <Button title={label} disabled={value.length !== 4} onPress={onSubmit} />
    </>
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
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  thumb: {
    width: 56,
    height: 72,
    borderRadius: 8,
  },
  steps: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  step: {
    flex: 1,
    gap: Spacing.one,
  },
  stepBar: {
    height: 4,
    borderRadius: 2,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  detail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  detailValue: {
    flexShrink: 1,
    textAlign: 'right',
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  code: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
  },
  codeText: {
    fontFamily: Fonts.heading,
    fontSize: 40,
    lineHeight: 52,
    letterSpacing: 8,
  },
  codeInput: {
    fontSize: 24,
    letterSpacing: 6,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  reportLink: {
    alignSelf: 'center',
  },
});

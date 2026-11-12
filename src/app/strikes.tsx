import { Stack } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListings } from '@/hooks/use-listings';
import { usePenalty, useReports, useStrikes } from '@/hooks/use-moderation';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { appealOption, fileAppeal, getAppealsSnapshot, latestAppealFor, subscribeToAppeals } from '@/lib/data/appeals';
import { SOFT_BAN_DAYS, STRIKE_WINDOW_DAYS, type Strike } from '@/lib/data/moderation';
import { MAX_APPEAL_LENGTH, type Appeal } from '@/lib/data/types';

const SOURCE_LABELS: Record<Strike['source'], string> = {
  no_show: 'Missed pickup',
  late_return: 'Late return',
  report: 'Upheld report',
};

/** Your strikes, why you got each one, and a way to appeal it. */
export default function StrikesScreen() {
  const user = useCurrentUser();
  const strikes = useStrikes(user.id);
  const penalty = usePenalty(user.id);
  const appeals = useSyncExternalStore(subscribeToAppeals, getAppealsSnapshot, getAppealsSnapshot);
  const removed = appeals.filter((appeal) => appeal.userId === user.id && appeal.status === 'approved');

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Your strikes' }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText themeColor="textSecondary">
            Strikes come from a missed pickup, a return more than 3 days late, or a report the team upheld. One is a
            warning, two limit your account for {SOFT_BAN_DAYS} days, and three suspend it. Each strike expires after{' '}
            {STRIKE_WINDOW_DAYS} days.
          </ThemedText>
          {strikes.length === 0 ? (
            <ThemedText style={styles.empty}>No strikes. Thanks for keeping Lendr easy for everyone!</ThemedText>
          ) : (
            <ThemedText type="smallBold">
              {strikes.length} active {strikes.length === 1 ? 'strike' : 'strikes'}
              {penalty.level === 'soft_ban' ? ' · account limited' : ''}
            </ThemedText>
          )}
          {strikes.map((strike) => (
            <StrikeCard
              key={`${strike.source}-${strike.refId}`}
              strike={strike}
              latest={latestAppealFor(appeals, strike)}
            />
          ))}
          {removed.length > 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {removed.length} {removed.length === 1 ? 'strike was' : 'strikes were'} removed on appeal.
            </ThemedText>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function StrikeCard({ strike, latest }: { strike: Strike; latest: Appeal | undefined }) {
  const theme = useTheme();
  const rentals = useRentals();
  const reports = useReports();
  const listings = useListings();
  const [writing, setWriting] = useState(false);
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const report = strike.source === 'report' ? reports.find((candidate) => candidate.id === strike.refId) : undefined;
  const rental = rentals.find((candidate) => candidate.id === (report?.rentalId ?? strike.refId));
  const listing = listings.find((candidate) => candidate.id === rental?.listingId);
  const option = appealOption(latest);
  const when = new Date(strike.at).toLocaleDateString([], { month: 'short', day: 'numeric' });

  async function send() {
    setError(null);
    setSending(true);
    try {
      await fileAppeal(strike, reason);
      setWriting(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">
        {SOURCE_LABELS[strike.source]} · {when}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {listing ? listing.title : report ? `Report: ${report.reason}` : 'A borrow'}
      </ThemedText>

      {latest ? <AppealStatus appeal={latest} /> : null}

      {option && !writing ? (
        <Button
          title={option === 'appeal' ? 'Appeal this strike' : 'Ask a person to review'}
          variant="outline"
          onPress={() => setWriting(true)}
        />
      ) : null}
      {writing ? (
        <>
          <TextField
            label={option === 'appeal' ? 'What happened?' : 'Why should a person take another look?'}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. They changed the pickup spot in chat and I was waiting at the new one."
            multiline
            maxLength={MAX_APPEAL_LENGTH}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {option === 'appeal'
              ? 'An automated reviewer looks at your appeal, the borrow and your chat, usually within minutes. Unclear cases go to the Lendr team.'
              : 'A person on the Lendr team will review it. This is the final review.'}
          </ThemedText>
          <View style={styles.row}>
            <Button title="Cancel" variant="secondary" style={styles.flex} onPress={() => setWriting(false)} />
            <Button
              title="Send appeal"
              style={styles.flex}
              disabled={sending || reason.trim().length < 10}
              onPress={send}
            />
          </View>
        </>
      ) : null}
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

function AppealStatus({ appeal }: { appeal: Appeal }) {
  const who = appeal.level === 2 ? 'Human review' : 'Appeal';
  if (appeal.status === 'pending') {
    return (
      <ThemedText type="small" themeColor="accent">
        {who} in review.{' '}
        {appeal.level === 1 && appeal.aiNote ? 'It needs a person to look, so the team will decide.' : ''}
      </ThemedText>
    );
  }
  return (
    <View style={styles.status}>
      <ThemedText type="small" themeColor={appeal.status === 'approved' ? 'accent' : 'danger'}>
        {who} {appeal.status === 'approved' ? 'approved: this strike was removed.' : 'denied.'}
      </ThemedText>
      {appeal.decisionNote ? (
        <ThemedText type="small" themeColor="textSecondary">
          {appeal.decisionNote}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  status: {
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});

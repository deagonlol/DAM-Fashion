import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  changedTerms,
  respondToProposal,
  withdrawProposal,
  type BorrowTerms,
  type TermField,
} from '@/lib/data/proposals';
import type { Rental, RentalProposal } from '@/lib/data/types';
import { formatDay, formatPrice, formatTime } from '@/lib/format';

type ProposalCardProps = {
  rental: Rental;
  proposal: RentalProposal;
  current: BorrowTerms;
  userId: string;
  /** First name of the other person in the borrow. */
  otherName: string;
};

/** An open counter-offer or change of plans: what changes, and accept / decline or withdraw. */
export function ProposalCard({ rental, proposal, current, userId, otherName }: ProposalCardProps) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = proposal.proposerId === userId;
  const counter = rental.status === 'requested';
  const changes = new Set(changedTerms(current, proposal));

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const title = mine
    ? counter
      ? `Your counter-offer is waiting for ${otherName}`
      : `Your new plans are waiting for ${otherName}`
    : counter
      ? `${otherName} sent a counter-offer`
      : `${otherName} proposed new plans`;

  const rows: { field: TermField | TermField[]; label: string; value: string }[] = [
    {
      field: ['startDate', 'pickupTime'],
      label: 'Pick up',
      value: `${formatDay(proposal.startDate)}${proposal.pickupTime ? `, ${formatTime(proposal.pickupTime)}` : ''}`,
    },
    {
      field: ['endDate', 'returnTime'],
      label: 'Return by',
      value: `${formatDay(proposal.endDate)}${proposal.returnTime ? `, ${formatTime(proposal.returnTime)}` : ''}`,
    },
    { field: 'pickupSpot', label: 'Where', value: proposal.pickupSpot },
    { field: 'pricePerDay', label: 'Price', value: `${formatPrice(proposal.pricePerDay)}/day` },
  ];

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.accent }]}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {rows.map((row) => {
        const fields = Array.isArray(row.field) ? row.field : [row.field];
        const changed = fields.some((field) => changes.has(field));
        return (
          <View key={row.label} style={styles.row}>
            <ThemedText type="small" themeColor="textSecondary">
              {row.label}
            </ThemedText>
            <ThemedText type="smallBold" themeColor={changed ? 'accent' : 'text'} style={styles.value}>
              {row.value}
              {changed ? ' (new)' : ''}
            </ThemedText>
          </View>
        );
      })}
      {proposal.note ? <ThemedText type="small">“{proposal.note}”</ThemedText> : null}
      {mine ? (
        <Button
          title="Withdraw"
          variant="secondary"
          disabled={busy}
          onPress={() => run(() => withdrawProposal(rental, proposal))}
        />
      ) : (
        <View style={styles.actions}>
          <Button
            title="Decline"
            variant="danger"
            style={styles.flex}
            disabled={busy}
            onPress={() => run(() => respondToProposal(rental, proposal, false))}
          />
          <Button
            title={counter ? 'Accept & confirm' : 'Accept'}
            style={styles.flex}
            disabled={busy}
            onPress={() => run(() => respondToProposal(rental, proposal, true))}
          />
        </View>
      )}
      {error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});

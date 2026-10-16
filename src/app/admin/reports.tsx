import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { STATUS_LABELS } from '@/components/rental-row';
import { ChipGroup } from '@/components/chip-group';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { usePenalty, useReports } from '@/hooks/use-moderation';
import { useRental } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { decideReport, type Penalty } from '@/lib/data/moderation';
import type { Report } from '@/lib/data/types';
import { formatDateRange, formatMessageTime } from '@/lib/format';

const TABS = ['Open', 'Reviewed'] as const;
type Tab = (typeof TABS)[number];

/** DAM Fashion team queue: uphold a report (adds a strike) or dismiss it. */
export default function AdminReportsScreen() {
  const user = useCurrentUser();
  const reports = useReports();
  const [tab, setTab] = useState<Tab>('Open');

  const shown = useMemo(
    () =>
      reports
        .filter((report) => (tab === 'Open' ? report.status === 'open' : report.status !== 'open'))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, tab]
  );

  if (user.role !== 'admin') {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Only the DAM Fashion team can see this.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Reports' }} />
      <FlatList
        data={shown}
        keyExtractor={(report) => report.id}
        renderItem={({ item }) => <ReportCard report={item} />}
        ListHeaderComponent={<ChipGroup options={TABS} value={tab} onChange={(next) => next && setTab(next)} />}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {tab === 'Open' ? 'No open reports. 🎉' : 'Nothing reviewed yet.'}
          </ThemedText>
        }
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ThemedView>
  );
}

function penaltyLabel(penalty: Penalty) {
  switch (penalty.level) {
    case 'none':
      return 'No strikes';
    case 'warning':
      return `${penalty.strikes} strike${penalty.strikes === 1 ? '' : 's'} · warning`;
    case 'soft_ban':
      return `2 strikes · limited until ${new Date(penalty.until).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
    case 'banned':
      return `${penalty.strikes} strikes · banned`;
  }
}

function ReportCard({ report }: { report: Report }) {
  const theme = useTheme();
  const reporter = useUser(report.reporterId);
  const reported = useUser(report.reportedUserId);
  const penalty = usePenalty(report.reportedUserId);
  const rental = useRental(report.rentalId);
  const listing = useListing(rental?.listingId ?? report.listingId);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'upheld' | 'dismissed') {
    setError(null);
    try {
      await decideReport(report.id, decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold" style={styles.flex}>
          {report.reason}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMessageTime(report.createdAt)}
        </ThemedText>
      </View>
      <Pressable onPress={() => router.push(`/user/${report.reportedUserId}`)} accessibilityRole="link">
        <ThemedText type="small">
          About <ThemedText type="smallBold">{reported?.name ?? 'unknown'}</ThemedText> ({penaltyLabel(penalty)}) ›
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        From {reporter?.name ?? 'unknown'}
        {report.rentalId ? ' · about a borrow' : report.conversationId ? ' · from a chat' : ''}
      </ThemedText>
      <ThemedText>{report.details}</ThemedText>

      {rental ? (
        <ThemedText type="small" themeColor="textSecondary">
          Borrow: {listing?.title ?? 'item'} · {formatDateRange(rental.startDate, rental.endDate)} ·{' '}
          {STATUS_LABELS[rental.status]}
        </ThemedText>
      ) : null}
      {report.conversationId ? (
        <Pressable onPress={() => router.push(`/chat/${report.conversationId}`)} accessibilityRole="link">
          <ThemedText type="small" themeColor="accent">
            View the chat ›
          </ThemedText>
        </Pressable>
      ) : null}

      {report.status === 'open' && rental?.status === 'no_show' && rental.noShowReportedBy !== report.reportedUserId ? (
        <ThemedText type="small" themeColor="textSecondary">
          This no-show already counts as a strike, so upholding won’t add another.
        </ThemedText>
      ) : null}

      {report.status === 'open' ? (
        <>
          <View style={styles.actions}>
            <Button title="Dismiss" variant="secondary" style={styles.flex} onPress={() => decide('dismissed')} />
            <Button title="Uphold (+1 strike)" style={styles.flex} onPress={() => decide('upheld')} />
          </View>
          {error ? (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          ) : null}
        </>
      ) : (
        <ThemedText type="smallBold" themeColor={report.status === 'upheld' ? 'danger' : 'textSecondary'}>
          {report.status === 'upheld' ? 'Upheld: strike added' : 'Dismissed'}
        </ThemedText>
      )}
    </View>
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
    padding: Spacing.four,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  headerRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});

import { Image } from 'expo-image';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ConditionPhotos } from '@/components/condition-photos';
import { STATUS_LABELS } from '@/components/rental-row';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { usePenalty, useReports } from '@/hooks/use-moderation';
import { useRental } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { decideAppeal, getAppealsSnapshot, subscribeToAppeals } from '@/lib/data/appeals';
import { decideReport, type Penalty } from '@/lib/data/moderation';
import { reportPhotoUrls } from '@/lib/data/photos';
import type { Appeal, Report } from '@/lib/data/types';
import { formatDateRange, formatMessageTime } from '@/lib/format';

const TABS = ['Open', 'Appeals', 'Reviewed'] as const;
type Tab = (typeof TABS)[number];

/**
 * Lendr team queue: uphold a report (adds a strike) or dismiss it, and decide appeals. The AI
 * reviewer handles clear cases; what's here is what it left for a person, with its notes.
 */
export default function AdminReportsScreen() {
  const user = useCurrentUser();
  const reports = useReports();
  const appeals = useSyncExternalStore(subscribeToAppeals, getAppealsSnapshot, getAppealsSnapshot);
  const [tab, setTab] = useState<Tab>('Open');
  const pendingAppeals = useMemo(
    () =>
      appeals.filter((appeal) => appeal.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [appeals]
  );

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
        <ThemedText themeColor="textSecondary">Only the Lendr team can see this.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Reports' }} />
      <FlatList<Report | Appeal>
        data={tab === 'Appeals' ? pendingAppeals : shown}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) =>
          tab === 'Appeals' ? <AppealCard appeal={item as Appeal} /> : <ReportCard report={item as Report} />
        }
        ListHeaderComponent={<ChipGroup options={TABS} value={tab} onChange={(next) => next && setTab(next)} />}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {tab === 'Open'
              ? 'No open reports. 🎉'
              : tab === 'Appeals'
                ? 'No appeals waiting. 🎉'
                : 'Nothing reviewed yet.'}
          </ThemedText>
        }
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ThemedView>
  );
}

const STRIKE_LABELS: Record<Appeal['source'], string> = {
  no_show: 'Missed pickup',
  late_return: 'Late return',
  report: 'Upheld report',
};

/** An appeal waiting for a person: a second appeal, or one the AI wasn't sure about. */
function AppealCard({ appeal }: { appeal: Appeal }) {
  const theme = useTheme();
  const person = useUser(appeal.userId);
  const penalty = usePenalty(appeal.userId);
  const reports = useReports();
  const report = appeal.source === 'report' ? reports.find((candidate) => candidate.id === appeal.refId) : undefined;
  const rental = useRental(report?.rentalId ?? (appeal.source === 'report' ? undefined : appeal.refId));
  const listing = useListing(rental?.listingId);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setError(null);
    try {
      await decideAppeal(appeal.id, approve, note);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <ThemedText type="smallBold" style={styles.flex}>
          {appeal.level === 2 ? 'Second appeal (final)' : 'Appeal'} · {STRIKE_LABELS[appeal.source]}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatMessageTime(appeal.createdAt)}
        </ThemedText>
      </View>
      <Pressable onPress={() => router.push(`/user/${appeal.userId}`)} accessibilityRole="link">
        <ThemedText type="small">
          From <ThemedText type="smallBold">{person?.name ?? 'unknown'}</ThemedText> ({penaltyLabel(penalty)}) ›
        </ThemedText>
      </Pressable>
      <ThemedText type="small" themeColor="textSecondary">
        {report ? `Report: ${report.reason}${report.details ? ` · “${report.details}”` : ''}` : ''}
        {rental ? `Borrow: ${listing?.title ?? 'item'} · ${formatDateRange(rental.startDate, rental.endDate)}` : ''}
      </ThemedText>
      <ThemedText>{appeal.reason}</ThemedText>
      {appeal.aiNote ? (
        <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            AI review
          </ThemedText>
          <ThemedText type="small">{appeal.aiNote}</ThemedText>
        </View>
      ) : null}
      {rental ? <ConditionPhotos rental={rental} readOnly /> : null}
      <TextField
        value={note}
        onChangeText={setNote}
        placeholder="Note to the student (optional, shown with the decision)"
        multiline
      />
      <View style={styles.actions}>
        <Button title="Deny" variant="danger" style={styles.flex} onPress={() => decide(false)} />
        <Button title="Approve (remove strike)" style={styles.flex} onPress={() => decide(true)} />
      </View>
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
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
        {report.rentalId
          ? ' · about a borrow'
          : report.messageId
            ? ' · about a message'
            : report.conversationId
              ? ' · from a chat'
              : ''}
      </ThemedText>
      <ThemedText>{report.details}</ThemedText>

      {report.messageText ? (
        <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            Reported message
          </ThemedText>
          <ThemedText>{report.messageText}</ThemedText>
        </View>
      ) : null}
      {report.photoPaths && report.photoPaths.length > 0 ? <ReportPhotos paths={report.photoPaths} /> : null}

      {rental ? <ConditionPhotos rental={rental} readOnly /> : null}
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

      {report.aiNote ? (
        <View style={[styles.quote, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small" themeColor="textSecondary">
            AI review
          </ThemedText>
          <ThemedText type="small">{report.aiNote}</ThemedText>
        </View>
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
          {report.decidedBy === 'ai' ? ' · by AI' : report.decidedBy === 'team' ? ' · by the team' : ''}
        </ThemedText>
      )}
    </View>
  );
}

/** Proof photos, loaded as short-lived links since the bucket is private. */
function ReportPhotos({ paths }: { paths: string[] }) {
  const theme = useTheme();
  const [urls, setUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const key = paths.join('|');

  useEffect(() => {
    let active = true;
    reportPhotoUrls(key.split('|'))
      .then((next) => active && setUrls(next))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Couldn’t load the photos.'));
    return () => {
      active = false;
    };
  }, [key]);

  if (error) {
    return (
      <ThemedText type="small" themeColor="danger">
        {error}
      </ThemedText>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
      {urls.map((url) => (
        <Image
          key={url}
          source={url}
          style={[styles.photo, { backgroundColor: theme.backgroundElement }]}
          contentFit="cover"
          accessibilityLabel="Report photo"
        />
      ))}
    </ScrollView>
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
  quote: {
    borderRadius: 10,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  photos: {
    gap: Spacing.two,
  },
  photo: {
    width: 120,
    aspectRatio: 3 / 4,
    borderRadius: 10,
  },
});

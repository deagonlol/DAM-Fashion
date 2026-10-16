import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBlockState } from '@/hooks/use-moderation';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { blockUser, MAX_REPORT_LENGTH, submitReport } from '@/lib/data/moderation';
import { REPORT_REASONS, type ReportReason } from '@/lib/data/types';

type Params = {
  userId: string;
  reason?: ReportReason;
  conversationId?: string;
  rentalId?: string;
  listingId?: string;
};

/** Report a user to the DAM Fashion team, with an option to block them too. */
export default function ReportScreen() {
  const { userId, reason: initialReason, conversationId, rentalId, listingId } = useLocalSearchParams<Params>();
  const reported = useUser(userId);
  const viewer = useCurrentUser();
  const { blockedByMe } = useBlockState(viewer.id, userId);
  const theme = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(
    initialReason && (REPORT_REASONS as readonly string[]).includes(initialReason) ? initialReason : null
  );
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = reported?.name ?? 'this person';
  const firstName = name.split(' ')[0];
  const where = conversationId ? 'your chat' : rentalId ? 'this borrow' : listingId ? 'this listing' : null;

  async function handleSubmit() {
    if (!reason) return;
    setError(null);
    try {
      await submitReport({ reportedUserId: userId, reason, details, conversationId, rentalId, listingId });
      if (alsoBlock) await blockUser(userId);
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  if (submitted) {
    return (
      <ThemedView style={styles.done}>
        <Stack.Screen options={{ title: 'Report sent' }} />
        <ThemedText type="subtitle">Thanks for telling us</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.center}>
          Our team will review it, usually within a day. {firstName} won’t know who reported them.
          {alsoBlock ? ` You’ve also blocked ${firstName}.` : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          If you ever feel unsafe, contact UTPD at (512) 471-4441 or call 911.
        </ThemedText>
        <Button title="Done" onPress={() => router.back()} style={styles.doneButton} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Report ${firstName}` }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <ThemedText>
            What happened{where ? ` in ${where}` : ''}? Reports are private and reviewed by the DAM Fashion team.
          </ThemedText>

          <View style={styles.section}>
            <ThemedText type="smallBold">Reason</ThemedText>
            <ChipGroup options={REPORT_REASONS} value={reason} onChange={setReason} />
          </View>

          <TextField
            label="Details"
            value={details}
            onChangeText={setDetails}
            placeholder="What happened, and when? Include anything that helps us look into it."
            multiline
            maxLength={MAX_REPORT_LENGTH}
          />

          {!blockedByMe ? (
            <View style={styles.section}>
              <ChipGroup
                options={[`Also block ${firstName}`] as const}
                value={alsoBlock ? `Also block ${firstName}` : null}
                allowDeselect
                onChange={(value) => setAlsoBlock(value !== null)}
              />
              <ThemedText type="small" themeColor="textSecondary">
                Blocking hides each other’s listings and stops messages and borrow requests.
              </ThemedText>
            </View>
          ) : null}

          <ThemedText type="small" themeColor="textSecondary">
            Repeat problems lead to a warning, then a 7-day limit, then a ban.
          </ThemedText>

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button title="Send report" disabled={!reason || !details.trim()} onPress={handleSubmit} />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  done: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  center: {
    textAlign: 'center',
  },
  doneButton: {
    alignSelf: 'stretch',
  },
});

import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { MultiChipGroup } from '@/components/chip-group';
import { StarInput } from '@/components/star-rating';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRental } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { MAX_REVIEW_LENGTH, submitReview } from '@/lib/data/reviews';
import { REVIEW_TAGS } from '@/lib/data/types';

const RATING_WORDS = ['', 'Poor', 'Not great', 'Okay', 'Good', 'Great'];

/** Review the other person in a completed borrow. */
export default function ReviewScreen() {
  const { rentalId } = useLocalSearchParams<{ rentalId: string }>();
  const rental = useRental(rentalId);
  const listing = useListing(rental?.listingId);
  const user = useCurrentUser();
  const theme = useTheme();
  const revieweeRole = rental?.borrowerId === user.id ? 'lender' : 'borrower';
  const reviewee = useUser(revieweeRole === 'lender' ? rental?.lenderId : rental?.borrowerId);
  const [rating, setRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!rental) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Borrow not found.</ThemedText>
      </ThemedView>
    );
  }

  const name = reviewee?.name ?? 'them';
  const firstName = name.split(' ')[0];

  async function handleSubmit() {
    if (!rental) return;
    setError(null);
    setSubmitting(true);
    try {
      await submitReview({ rentalId: rental.id, rating, tags, comment });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: `Review ${firstName}` }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.who}>
            <Avatar name={name} uri={reviewee?.avatarUrl} size={56} />
            <View style={styles.flex}>
              <ThemedText type="smallBold">
                How was {revieweeRole === 'lender' ? 'borrowing from' : 'lending to'} {firstName}?
              </ThemedText>
              {listing ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {listing.title}
                </ThemedText>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <StarInput value={rating} onChange={setRating} />
            <ThemedText type="small" themeColor="textSecondary">
              {rating > 0 ? RATING_WORDS[rating] : 'Tap to rate'}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="smallBold">What stood out? (optional)</ThemedText>
            <MultiChipGroup options={REVIEW_TAGS[revieweeRole]} values={tags} onChange={setTags} />
          </View>

          <TextField
            label="Comment (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder={
              revieweeRole === 'lender' ? 'Was it as described? How was pickup?' : 'Was it returned on time and in good shape?'
            }
            multiline
            maxLength={MAX_REVIEW_LENGTH}
          />

          <View style={[styles.note, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="small" themeColor="textSecondary">
              Your review stays hidden until {firstName} reviews you too, so you can be honest. {firstName} can post
              one public reply.
            </ThemedText>
          </View>

          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>

        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button title="Submit review" disabled={rating === 0 || submitting} onPress={handleSubmit} />
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
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  note: {
    borderRadius: 12,
    padding: Spacing.three,
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

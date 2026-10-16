import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Stars } from '@/components/star-rating';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useRental } from '@/hooks/use-rentals';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';
import { MAX_REPLY_LENGTH, replyToReview } from '@/lib/data/reviews';
import type { Review } from '@/lib/data/types';
import { formatMonthYear } from '@/lib/format';

type ReviewCardProps = {
  review: Review;
  /** Show a reply box when the viewer is the reviewee and hasn't replied yet. */
  canReply?: boolean;
};

/** A public review: who wrote it, what was borrowed, rating, tags, comment, and any reply. */
export function ReviewCard({ review, canReply = false }: ReviewCardProps) {
  const theme = useTheme();
  const reviewer = useUser(review.reviewerId);
  const reviewee = useUser(review.revieweeId);
  const rental = useRental(review.rentalId);
  const listing = useListing(rental?.listingId);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');

  // Which side of the borrow the reviewed person was on, and what changed hands.
  const role = review.revieweeRole === 'lender' ? 'As lender' : 'As borrower';
  const context = listing ? `${role} · ${listing.title}` : role;

  async function submitReply() {
    try {
      await replyToReview(review.id, replyText);
      setReplying(false);
      setReplyText('');
    } catch (e) {
      Alert.alert('Could not post reply', e instanceof Error ? e.message : undefined);
    }
  }

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/user/${review.reviewerId}`)}
          accessibilityRole="link"
          style={styles.reviewer}>
          <Avatar name={reviewer?.name ?? '?'} uri={reviewer?.avatarUrl} size={36} />
          <View style={styles.flex}>
            <ThemedText type="smallBold">{reviewer?.name ?? 'Someone'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatMonthYear(review.createdAt)}
            </ThemedText>
          </View>
        </Pressable>
        <Stars rating={review.rating} />
      </View>

      {listing ? (
        <Pressable onPress={() => router.push(`/listing/${listing.id}`)} accessibilityRole="link">
          <ThemedText type="small" themeColor="textSecondary">
            {context} ›
          </ThemedText>
        </Pressable>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {context}
        </ThemedText>
      )}

      {review.tags.length > 0 ? (
        <View style={styles.tags}>
          {review.tags.map((tag) => (
            <View key={tag} style={[styles.tag, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText type="small">{tag}</ThemedText>
            </View>
          ))}
        </View>
      ) : null}

      {review.comment ? <ThemedText>{review.comment}</ThemedText> : null}

      {review.reply ? (
        <View style={[styles.reply, { borderColor: theme.accent }]}>
          <ThemedText type="smallBold">Reply from {reviewee?.name ?? 'them'}</ThemedText>
          <ThemedText type="small">{review.reply.text}</ThemedText>
        </View>
      ) : canReply ? (
        replying ? (
          <View style={styles.replyForm}>
            <TextField
              value={replyText}
              onChangeText={setReplyText}
              placeholder="Write a public reply"
              multiline
              maxLength={MAX_REPLY_LENGTH}
              autoFocus
            />
            <View style={styles.replyActions}>
              <Button title="Cancel" variant="secondary" style={styles.flex} onPress={() => setReplying(false)} />
              <Button title="Post reply" style={styles.flex} disabled={!replyText.trim()} onPress={submitReply} />
            </View>
          </View>
        ) : (
          <Pressable onPress={() => setReplying(true)} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="smallBold" themeColor="accent">
              Reply
            </ThemedText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  reviewer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  reply: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.three,
    gap: Spacing.half,
  },
  replyForm: {
    gap: Spacing.two,
  },
  replyActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});

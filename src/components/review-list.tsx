import type { ReactElement } from 'react';
import { FlatList, StyleSheet } from 'react-native';

import { ReviewCard } from '@/components/review-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Review } from '@/lib/data/types';

type ReviewListProps = {
  reviews: Review[];
  header?: ReactElement;
  emptyText?: string;
  /** The viewer's id, so they get a reply box on reviews about them. */
  viewerId?: string;
};

/** Scrolling list of review cards with an optional header, matching ListingGrid's layout. */
export function ReviewList({ reviews, header, emptyText = 'No reviews yet.', viewerId }: ReviewListProps) {
  return (
    <FlatList
      data={reviews}
      keyExtractor={(review) => review.id}
      renderItem={({ item }) => (
        <ReviewCard review={item} canReply={viewerId !== undefined && item.revieweeId === viewerId && !item.reply} />
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {emptyText}
        </ThemedText>
      }
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});

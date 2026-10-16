import { useMemo, useSyncExternalStore } from 'react';

import { useNow } from '@/hooks/use-now';
import { useRentals } from '@/hooks/use-rentals';
import { getReviewsSnapshot, isReviewVisible, subscribeToReviews, visibleReviewsAbout } from '@/lib/data/reviews';

export function useAllReviews() {
  return useSyncExternalStore(subscribeToReviews, getReviewsSnapshot);
}

/** Public reviews about a user, newest first. */
export function useReviewsAbout(userId: string) {
  const reviews = useAllReviews();
  const rentals = useRentals();
  const now = useNow();
  return useMemo(() => visibleReviewsAbout(userId, reviews, rentals, now), [userId, reviews, rentals, now]);
}

/** Public reviews of lenders written by people who borrowed this listing. */
export function useListingReviews(listingId: string) {
  const reviews = useAllReviews();
  const rentals = useRentals();
  const now = useNow();
  return useMemo(() => {
    const rentalIds = new Set(rentals.filter((rental) => rental.listingId === listingId).map((rental) => rental.id));
    return reviews
      .filter(
        (review) =>
          rentalIds.has(review.rentalId) &&
          review.revieweeRole === 'lender' &&
          isReviewVisible(review, reviews, rentals, now)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [listingId, reviews, rentals, now]);
}

/** Both reviews for one borrow (either may be missing). */
export function useRentalReviews(rentalId: string | undefined) {
  const reviews = useAllReviews();
  return useMemo(() => reviews.filter((review) => review.rentalId === rentalId), [reviews, rentalId]);
}

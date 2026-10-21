import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useRentals } from '@/hooks/use-rentals';
import { useStrikes } from '@/hooks/use-moderation';
import { useNow } from '@/hooks/use-now';
import { useReviewsAbout } from '@/hooks/use-reviews';
import { badgesFor, type BadgeId } from '@/lib/data/badges';
import { borrowCount, lendCount } from '@/lib/data/rentals';
import { averageRating } from '@/lib/data/reviews';
import type { EventTag } from '@/lib/data/types';
import { getUsersSnapshot, subscribeToUsers, userMatches } from '@/lib/data/users';

function useAllUsers() {
  return useSyncExternalStore(subscribeToUsers, getUsersSnapshot);
}

export function useUser(id: string | undefined) {
  const users = useAllUsers();
  return useMemo(() => users.find((user) => user.id === id), [users, id]);
}

/** Users whose name matches the query. An empty query returns everyone. */
export function useUserSearch(query: string) {
  const users = useAllUsers();
  return useMemo(() => users.filter((user) => userMatches(user, query)), [users, query]);
}

export type UserStats = {
  listingCount: number;
  /** Completed lends and borrows, counting repeats. */
  lendCount: number;
  borrowCount: number;
  /** Average of public reviews, or null with none. */
  rating: number | null;
  reviewCount: number;
  /** The events this user's listings are most often tagged with, most common first. */
  topEvents: EventTag[];
};

export function useUserStats(userId: string): UserStats {
  const listings = useListings();
  const rentals = useRentals();
  const reviews = useReviewsAbout(userId);

  return useMemo(() => {
    const owned = listings.filter((listing) => listing.ownerId === userId);
    const eventCounts = new Map<EventTag, number>();
    for (const listing of owned) {
      for (const event of listing.events) {
        eventCounts.set(event, (eventCounts.get(event) ?? 0) + 1);
      }
    }
    const topEvents = [...eventCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([event]) => event);
    return {
      listingCount: owned.length,
      lendCount: lendCount(rentals, userId),
      borrowCount: borrowCount(rentals, userId),
      rating: averageRating(reviews),
      reviewCount: reviews.length,
      topEvents,
    };
  }, [listings, rentals, reviews, userId]);
}

/** The trust badges a user currently holds. */
export function useBadges(userId: string): BadgeId[] {
  const user = useUser(userId);
  const rentals = useRentals();
  const reviews = useReviewsAbout(userId);
  const strikes = useStrikes(userId);
  const now = useNow();
  return useMemo(
    () =>
      badgesFor({
        userId,
        // Emails aren't public, but the database only lets @utexas.edu emails sign up.
        isVerifiedStudent: user !== undefined,
        rentals,
        reviews,
        strikes,
        now,
      }),
    [userId, user, rentals, reviews, strikes, now]
  );
}

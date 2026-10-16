import { useMemo, useSyncExternalStore } from 'react';

import { useNow } from '@/hooks/use-now';
import { getRentalsSnapshot, isOverdue, subscribeToRentals } from '@/lib/data/rentals';
import { canReview, getReviewsSnapshot, subscribeToReviews } from '@/lib/data/reviews';
import type { Rental } from '@/lib/data/types';

export function useRentals() {
  return useSyncExternalStore(subscribeToRentals, getRentalsSnapshot);
}

export function useRental(id: string | undefined) {
  const rentals = useRentals();
  return useMemo(() => rentals.find((rental) => rental.id === id), [rentals, id]);
}

export type ActivityItem = {
  rental: Rental;
  role: 'borrower' | 'lender';
  /** Short reason this needs the user's attention, or null if it's just in progress. */
  needsAction: string | null;
  /** Sort order: lower is more urgent. */
  priority: number;
};

/**
 * Borrows the user is part of that are still in progress or waiting on a review,
 * with the ones needing action first.
 */
export function useActivity(userId: string): ActivityItem[] {
  const rentals = useRentals();
  const reviews = useSyncExternalStore(subscribeToReviews, getReviewsSnapshot);
  const now = useNow();

  return useMemo(() => {
    const items: ActivityItem[] = [];
    for (const rental of rentals) {
      const role = rental.borrowerId === userId ? 'borrower' : rental.lenderId === userId ? 'lender' : null;
      if (!role) continue;

      // Priority: 0 overdue, 1 respond to a request, 2 handoffs, 3 reviews, 4 waiting on the other person.
      let needsAction: string | null = null;
      let priority = 4;
      let include = true;
      switch (rental.status) {
        case 'requested':
          if (role === 'lender') {
            needsAction = 'Respond to request';
            priority = 1;
          }
          break;
        case 'accepted':
          needsAction = role === 'borrower' ? 'Enter pickup code at handoff' : 'Show pickup code at handoff';
          priority = 2;
          break;
        case 'picked_up':
          if (isOverdue(rental, now)) {
            needsAction = role === 'borrower' ? 'Overdue: return it' : 'Overdue';
            priority = 0;
          } else if (role === 'lender') {
            needsAction = 'Enter return code at return';
            priority = 2;
          }
          break;
        case 'returned':
          include = canReview(rental, userId, reviews, now);
          needsAction = include ? 'Leave a review' : null;
          priority = 3;
          break;
        default:
          include = false;
      }
      if (include) items.push({ rental, role, needsAction, priority });
    }
    return items.sort(
      (a, b) => a.priority - b.priority || a.rental.startDate.localeCompare(b.rental.startDate)
    );
  }, [rentals, reviews, userId, now]);
}

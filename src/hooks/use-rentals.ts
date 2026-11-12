import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { listingMentions } from '@/lib/data/listings';
import {
  getRentalsSnapshot,
  isExpiredRequest,
  isOverdue,
  ordersFor,
  subscribeToRentals,
  toDateString,
} from '@/lib/data/rentals';
import { canReview, getReviewsSnapshot, subscribeToReviews } from '@/lib/data/reviews';
import { getSalesSnapshot, saleOrdersFor, subscribeToSales } from '@/lib/data/sales';
import type { Rental, Sale } from '@/lib/data/types';
import { getUsersSnapshot, subscribeToUsers } from '@/lib/data/users';

export function useRentals() {
  return useSyncExternalStore(subscribeToRentals, getRentalsSnapshot, getRentalsSnapshot);
}

export function useRental(id: string | undefined) {
  const rentals = useRentals();
  return useMemo(() => rentals.find((rental) => rental.id === id), [rentals, id]);
}

/** One row on the Orders tab: a borrow, or a buy request. */
export type OrderItem = { kind: 'rental'; rental: Rental } | { kind: 'sale'; sale: Sale };

/**
 * The user's borrows and buy requests on one side of the Orders tab, split into
 * `{ active, past, requests }`. Rentals come first in each list, then sales. A search matches
 * the item or the other person's name.
 */
export function useOrders(userId: string, role: 'borrower' | 'lender', query = '') {
  const rentals = useRentals();
  const sales = useSyncExternalStore(subscribeToSales, getSalesSnapshot, getSalesSnapshot);
  const listings = useListings();
  const users = useSyncExternalStore(subscribeToUsers, getUsersSnapshot, getUsersSnapshot);
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (listingId: string, otherId: string) => {
      if (!q) return true;
      const listing = listings.find((item) => item.id === listingId);
      const other = users.find((user) => user.id === otherId);
      return (listing && listingMentions(listing, q)) || !!other?.name.toLowerCase().includes(q);
    };
    const rentalLists = ordersFor(
      rentals.filter((rental) => matches(rental.listingId, role === 'borrower' ? rental.lenderId : rental.borrowerId)),
      userId,
      role
    );
    const saleLists = saleOrdersFor(
      sales.filter((sale) => matches(sale.listingId, role === 'borrower' ? sale.sellerId : sale.buyerId)),
      userId,
      role === 'borrower' ? 'buyer' : 'seller'
    );
    const merge = (list: 'active' | 'past' | 'requests'): OrderItem[] => [
      ...rentalLists[list].map((rental) => ({ kind: 'rental' as const, rental })),
      ...saleLists[list].map((sale) => ({ kind: 'sale' as const, sale })),
    ];
    return { active: merge('active'), past: merge('past'), requests: merge('requests') };
  }, [rentals, sales, listings, users, userId, role, query]);
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
  const reviews = useSyncExternalStore(subscribeToReviews, getReviewsSnapshot, getReviewsSnapshot);
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
          // A request whose pickup day passed can't happen anymore; it waits in Past instead.
          if (isExpiredRequest(rental, toDateString(now))) {
            include = false;
          } else if (role === 'lender') {
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

import { useMemo, useSyncExternalStore } from 'react';

import { useCurrentUser } from '@/hooks/use-session';
import { getListingsSnapshot, matchesFilters, sortListings, subscribeToListings } from '@/lib/data/listings';
import { borrowedListings, getRentalsSnapshot, subscribeToRentals } from '@/lib/data/rentals';
import { tasteFromListings } from '@/lib/data/search';
import type { ListingFilters, ListingSort } from '@/lib/data/types';

export function useListings() {
  return useSyncExternalStore(subscribeToListings, getListingsSnapshot);
}

export function useFilteredListings(filters: ListingFilters, sort: ListingSort = 'For you') {
  const listings = useListings();
  const viewer = useCurrentUser();
  const borrowed = useBorrowedListings(viewer.id);
  const taste = useMemo(
    () =>
      tasteFromListings([
        ...listings.filter((listing) => listing.ownerId === viewer.id),
        ...borrowed,
      ]),
    [listings, borrowed, viewer.id]
  );
  return useMemo(
    () =>
      sortListings(
        listings.filter((listing) => matchesFilters(listing, filters)),
        sort,
        filters.query,
        { taste, words: filters.interpreted ? filters.words : [] }
      ),
    [listings, filters, sort, taste]
  );
}

export function useListing(id: string | undefined) {
  const listings = useListings();
  return useMemo(() => listings.find((listing) => listing.id === id), [listings, id]);
}

export function useListingsByOwner(ownerId: string) {
  const listings = useListings();
  return useMemo(() => listings.filter((listing) => listing.ownerId === ownerId), [listings, ownerId]);
}

/** Listings a user has borrowed, most recently borrowed first, each item once. */
export function useBorrowedListings(borrowerId: string) {
  const listings = useListings();
  const rentals = useSyncExternalStore(subscribeToRentals, getRentalsSnapshot);
  return useMemo(() => borrowedListings(rentals, listings, borrowerId), [listings, rentals, borrowerId]);
}

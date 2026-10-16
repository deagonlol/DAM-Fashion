import { useMemo, useSyncExternalStore } from 'react';

import { getListingsSnapshot, matchesFilters, sortListings, subscribeToListings } from '@/lib/data/listings';
import { borrowedListings, getRentalsSnapshot, subscribeToRentals } from '@/lib/data/rentals';
import type { ListingFilters, ListingSort } from '@/lib/data/types';

export function useListings() {
  return useSyncExternalStore(subscribeToListings, getListingsSnapshot);
}

export function useFilteredListings(filters: ListingFilters, sort: ListingSort = 'Newest') {
  const listings = useListings();
  return useMemo(
    () =>
      sortListings(
        listings.filter((listing) => matchesFilters(listing, filters)),
        sort,
        filters.query
      ),
    [listings, filters, sort]
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

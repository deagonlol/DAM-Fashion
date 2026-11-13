import { useMemo, useSyncExternalStore } from 'react';

import { useCurrentUser } from '@/hooks/use-session';
import { getListingsSnapshot, matchesFilters, sortListings, subscribeToListings } from '@/lib/data/listings';
import { borrowedListings, getRentalsSnapshot, subscribeToRentals } from '@/lib/data/rentals';
import { getSavesSnapshot, subscribeToSaves } from '@/lib/data/saves';
import { tasteFromSignals } from '@/lib/data/search';
import { getShelvesSnapshot, subscribeToShelves } from '@/lib/data/shelves';
import type { ListingFilters, ListingSort } from '@/lib/data/types';

export function useListings() {
  return useSyncExternalStore(subscribeToListings, getListingsSnapshot, getListingsSnapshot);
}

export function useFilteredListings(filters: ListingFilters, sort: ListingSort = 'For you') {
  const listings = useListings();
  const viewer = useCurrentUser();
  const borrowed = useBorrowedListings(viewer.id);
  const saves = useSyncExternalStore(subscribeToSaves, getSavesSnapshot, getSavesSnapshot);
  const shelves = useSyncExternalStore(subscribeToShelves, getShelvesSnapshot, getShelvesSnapshot);
  // "For you" learns from hearts, shelves, borrows, and what you list.
  const taste = useMemo(() => {
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((listing) => listing !== undefined);
    return tasteFromSignals({
      saved: pick(saves.filter((save) => save.userId === viewer.id).map((save) => save.listingId)),
      shelved: pick(shelves.filter((shelf) => shelf.ownerId === viewer.id).flatMap((shelf) => shelf.listingIds)),
      borrowed,
      owned: listings.filter((listing) => listing.ownerId === viewer.id),
    });
  }, [listings, borrowed, saves, shelves, viewer.id]);
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
  const rentals = useSyncExternalStore(subscribeToRentals, getRentalsSnapshot, getRentalsSnapshot);
  return useMemo(() => borrowedListings(rentals, listings, borrowerId), [listings, rentals, borrowerId]);
}

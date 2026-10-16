import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useCurrentUser } from '@/hooks/use-session';
import { getSavesSnapshot, subscribeToSaves } from '@/lib/data/saves';

function useAllSaves() {
  return useSyncExternalStore(subscribeToSaves, getSavesSnapshot);
}

/** Whether the signed-in user saved the listing, and how many people saved it in total. */
export function useSaveState(listingId: string) {
  const saves = useAllSaves();
  const user = useCurrentUser();
  return useMemo(() => {
    const forListing = saves.filter((save) => save.listingId === listingId);
    return {
      isSaved: forListing.some((save) => save.userId === user.id),
      count: forListing.length,
    };
  }, [saves, listingId, user.id]);
}

/** Listings the user saved, most recently saved first. */
export function useSavedListings(userId: string) {
  const saves = useAllSaves();
  const listings = useListings();
  return useMemo(
    () =>
      saves
        .filter((save) => save.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((save) => listings.find((listing) => listing.id === save.listingId))
        .filter((listing) => listing !== undefined),
    [saves, listings, userId]
  );
}

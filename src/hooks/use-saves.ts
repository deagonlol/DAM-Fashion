import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useCurrentUser } from '@/hooks/use-session';
import {
  getSaveCountsSnapshot,
  getSavesSnapshot,
  subscribeToSaveCounts,
  subscribeToSaves,
} from '@/lib/data/saves';

/** The signed-in user's saves. */
function useAllSaves() {
  return useSyncExternalStore(subscribeToSaves, getSavesSnapshot);
}

/** Whether the signed-in user saved the listing, and how many people saved it in total. */
export function useSaveState(listingId: string) {
  const saves = useAllSaves();
  const counts = useSyncExternalStore(subscribeToSaveCounts, getSaveCountsSnapshot);
  const user = useCurrentUser();
  return useMemo(
    () => ({
      isSaved: saves.some((save) => save.listingId === listingId && save.userId === user.id),
      count: counts[listingId] ?? 0,
    }),
    [saves, counts, listingId, user.id]
  );
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

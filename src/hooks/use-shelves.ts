import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { getShelvesSnapshot, subscribeToShelves } from '@/lib/data/shelves';
import type { Listing, Shelf } from '@/lib/data/types';

export type ShelfWithListings = Shelf & { listings: Listing[] };

/** The signed-in user's shelves, newest first, with their listings resolved. */
export function useShelves(): ShelfWithListings[] {
  const shelves = useSyncExternalStore(subscribeToShelves, getShelvesSnapshot, getShelvesSnapshot);
  const listings = useListings();
  return useMemo(() => {
    const byId = new Map(listings.map((listing) => [listing.id, listing]));
    return [...shelves]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((shelf) => ({
        ...shelf,
        // A listing its owner deleted drops off the shelf.
        listings: shelf.listingIds.map((id) => byId.get(id)).filter((listing) => listing !== undefined),
      }));
  }, [shelves, listings]);
}

export function useShelf(shelfId: string): ShelfWithListings | undefined {
  const shelves = useShelves();
  return useMemo(() => shelves.find((shelf) => shelf.id === shelfId), [shelves, shelfId]);
}

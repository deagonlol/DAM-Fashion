import { useMemo } from 'react';

import { useFilteredListings } from '@/hooks/use-listings';
import { useBlocks, useRestrictedUserIds } from '@/hooks/use-moderation';
import { useCurrentUser } from '@/hooks/use-session';
import { useUserSearch } from '@/hooks/use-users';
import { isBlockedBetween } from '@/lib/data/moderation';
import type { ListingFilters, ListingSort } from '@/lib/data/types';

/**
 * Listings to show when browsing: filtered and sorted, minus paused listings, listings from
 * restricted owners, and anyone the viewer blocked or was blocked by.
 */
export function useBrowseListings(filters: ListingFilters, sort: ListingSort) {
  const results = useFilteredListings(filters, sort);
  const viewer = useCurrentUser();
  const blocks = useBlocks();
  const restricted = useRestrictedUserIds();
  return useMemo(
    () =>
      results.filter(
        (listing) =>
          !listing.paused &&
          !restricted.has(listing.ownerId) &&
          !isBlockedBetween(blocks, viewer.id, listing.ownerId)
      ),
    [results, viewer.id, blocks, restricted]
  );
}

/** People search minus the team account, banned users, and blocked users. */
export function useBrowsePeople(query: string) {
  const people = useUserSearch(query);
  const viewer = useCurrentUser();
  const blocks = useBlocks();
  const restricted = useRestrictedUserIds();
  return useMemo(
    () =>
      people.filter(
        (user) => user.role !== 'admin' && !restricted.has(user.id) && !isBlockedBetween(blocks, viewer.id, user.id)
      ),
    [people, viewer.id, blocks, restricted]
  );
}

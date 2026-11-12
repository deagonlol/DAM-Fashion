import { useMemo, useSyncExternalStore } from 'react';

import { useBrowseListings } from '@/hooks/use-browse';
import { useCurrentUser } from '@/hooks/use-session';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { getSavedSearchesSnapshot, newMatches, subscribeToSavedSearches } from '@/lib/data/saved-searches';

export function useSavedSearches() {
  return useSyncExternalStore(subscribeToSavedSearches, getSavedSearchesSnapshot, getSavedSearchesSnapshot);
}

/** Saved searches, newest first, each with how many new listings match it (not counting your own). */
export function useSavedSearchesWithCounts() {
  const searches = useSavedSearches();
  const viewer = useCurrentUser();
  const browsable = useBrowseListings(EMPTY_FILTERS, 'Newest');
  return useMemo(() => {
    const others = browsable.filter((listing) => listing.ownerId !== viewer.id);
    return [...searches]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((search) => ({ search, newCount: newMatches(search, others).length }));
  }, [searches, browsable, viewer.id]);
}

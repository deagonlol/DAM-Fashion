/**
 * Saved searches: a search's text and filters, kept so a student can come back to it and see
 * how many new listings match since they last looked. Private to each user.
 */
import { formatPrice } from '../format';
import { supabase } from '../supabase';
import { EMPTY_FILTERS, matchesFilters } from './listings';
import { unwrap } from './rows';
import { getCurrentUserId } from './session';
import { createStore } from './store';
import type { Listing, ListingFilters } from './types';

export type SavedSearch = {
  id: string;
  label: string;
  filters: ListingFilters;
  lastSeenAt: string;
  createdAt: string;
};

type SavedSearchRow = {
  id: string;
  label: string;
  filters: Partial<ListingFilters>;
  last_seen_at: string;
  created_at: string;
};

export function toSavedSearch(row: SavedSearchRow): SavedSearch {
  return {
    id: row.id,
    label: row.label,
    // Older saves may miss newer filter fields; fill them in.
    filters: { ...EMPTY_FILTERS, ...row.filters },
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
  };
}

const savedSearchesStore = createStore<SavedSearch[]>([]);

export const subscribeToSavedSearches = savedSearchesStore.subscribe;
export const getSavedSearchesSnapshot = savedSearchesStore.get;

export function setSavedSearches(searches: SavedSearch[]) {
  savedSearchesStore.set(searches);
}

/** Whether a search has anything to save: text, a chip, a price limit, or rent / buy. */
export function hasSearchCriteria(filters: ListingFilters) {
  return (
    filters.query.trim().length > 0 ||
    filters.categories.length > 0 ||
    filters.events.length > 0 ||
    filters.sizes.length > 0 ||
    filters.maxPrice !== null ||
    filters.deal !== null
  );
}

/** Two searches are the same when they'd show the same results. */
export function sameSearch(a: ListingFilters, b: ListingFilters) {
  const key = (f: ListingFilters) =>
    JSON.stringify([
      f.query.trim().toLowerCase(),
      [...f.categories].sort(),
      [...f.events].sort(),
      [...f.sizes].sort(),
      f.maxPrice,
      f.deal,
    ]);
  return key(a) === key(b);
}

/** A short name for a search, e.g. "black dress · S · under $15". */
export function describeSearch(filters: ListingFilters) {
  const parts = [
    filters.query.trim() || null,
    ...(filters.query.trim() ? [] : [...filters.events, ...filters.categories]),
    ...filters.sizes,
    filters.maxPrice !== null ? `under ${formatPrice(filters.maxPrice)}` : null,
    filters.deal ? `to ${filters.deal.toLowerCase()}` : null,
  ].filter((part): part is string => !!part);
  return (parts.join(' · ') || 'Saved search').slice(0, 60);
}

/** Listings that match the search and were posted after it was last opened. */
export function newMatches(search: SavedSearch, listings: Listing[]) {
  return listings.filter((listing) => listing.createdAt > search.lastSeenAt && matchesFilters(listing, search.filters));
}

export async function saveSearch(filters: ListingFilters) {
  getCurrentUserId();
  const row: SavedSearchRow = unwrap(
    await supabase
      .from('saved_searches')
      .insert({ label: describeSearch(filters), filters })
      .select()
      .single()
  );
  savedSearchesStore.set([...savedSearchesStore.get(), toSavedSearch(row)]);
}

export async function deleteSavedSearch(id: string) {
  unwrap(await supabase.from('saved_searches').delete().eq('id', id));
  savedSearchesStore.set(savedSearchesStore.get().filter((search) => search.id !== id));
}

/** Resets the "new" count: everything listed until now has been seen. */
export async function markSavedSearchSeen(id: string) {
  const now = new Date().toISOString();
  savedSearchesStore.set(
    savedSearchesStore.get().map((search) => (search.id === id ? { ...search, lastSeenAt: now } : search))
  );
  await supabase.from('saved_searches').update({ last_seen_at: now }).eq('id', id);
}

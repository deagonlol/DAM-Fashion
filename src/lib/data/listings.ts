/**
 * Listing data access. Screens and hooks import from here, never from mock-data directly,
 * so this file is the one place to swap in Supabase later.
 */
import { assertCanTransact } from './moderation';
import { rentalsStore } from './rentals-store';
import { getCurrentUserId } from './session';
import { MOCK_LISTINGS } from './mock-data';
import { createStore } from './store';
import type { Listing, ListingFilters, ListingSort, NewListing, Rental } from './types';

const listingsStore = createStore<Listing[]>(
  [...MOCK_LISTINGS].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
);

export const subscribeToListings = listingsStore.subscribe;
/** Synchronous snapshot for useSyncExternalStore. Replaced by query caching once there's a backend. */
export const getListingsSnapshot = listingsStore.get;

export const EMPTY_FILTERS: ListingFilters = {
  query: '',
  categories: [],
  events: [],
  sizes: [],
  maxPrice: null,
};

/** Client-side filter. With Supabase this becomes query conditions (ilike, in, overlaps, lte). */
export function matchesFilters(listing: Listing, filters: ListingFilters) {
  const query = filters.query.trim().toLowerCase();
  if (
    query &&
    ![listing.title, listing.description, listing.category, ...listing.events].some((text) =>
      text.toLowerCase().includes(query)
    )
  ) {
    return false;
  }
  if (filters.categories.length > 0 && !filters.categories.includes(listing.category)) return false;
  if (filters.events.length > 0 && !listing.events.some((event) => filters.events.includes(event))) {
    return false;
  }
  if (filters.sizes.length > 0 && !filters.sizes.includes(listing.size)) return false;
  if (filters.maxPrice !== null && listing.pricePerDay > filters.maxPrice) return false;
  return true;
}

/**
 * How well a listing matches the search text: title matches count most, then type or event,
 * then description. A stand-in until real search ranking (e.g. Postgres full-text) exists.
 */
function relevanceScore(listing: Listing, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  let score = 0;
  if (listing.title.toLowerCase().includes(q)) score += 3;
  if (listing.title.toLowerCase().startsWith(q)) score += 1;
  if ([listing.category, ...listing.events].some((tag) => tag.toLowerCase().includes(q))) score += 2;
  if (listing.description.toLowerCase().includes(q)) score += 1;
  return score;
}

const newestFirst = (a: Listing, b: Listing) => b.createdAt.localeCompare(a.createdAt);

/** Returns a sorted copy. Ties fall back to newest first. */
export function sortListings(listings: Listing[], sort: ListingSort, query: string) {
  const sorted = [...listings];
  switch (sort) {
    case 'Most relevant':
      return sorted.sort(
        (a, b) => relevanceScore(b, query) - relevanceScore(a, query) || newestFirst(a, b)
      );
    case 'Price: low to high':
      return sorted.sort((a, b) => a.pricePerDay - b.pricePerDay || newestFirst(a, b));
    case 'Price: high to low':
      return sorted.sort((a, b) => b.pricePerDay - a.pricePerDay || newestFirst(a, b));
    case 'Newest':
      return sorted.sort(newestFirst);
  }
}

export async function getListings(
  filters: ListingFilters = EMPTY_FILTERS,
  sort: ListingSort = 'Newest'
): Promise<Listing[]> {
  const matches = listingsStore.get().filter((listing) => matchesFilters(listing, filters));
  return sortListings(matches, sort, filters.query);
}

export async function getListing(id: string): Promise<Listing | undefined> {
  return getListingSnapshot(id);
}

export function getListingSnapshot(id: string): Listing | undefined {
  return listingsStore.get().find((listing) => listing.id === id);
}

export async function getListingsByOwner(ownerId: string): Promise<Listing[]> {
  return listingsStore.get().filter((listing) => listing.ownerId === ownerId);
}

export async function createListing(input: NewListing): Promise<Listing> {
  const ownerId = getCurrentUserId();
  assertCanTransact(ownerId, new Date());
  const listing: Listing = {
    ...input,
    id: `l${Date.now()}`,
    ownerId,
    createdAt: new Date().toISOString(),
  };
  listingsStore.set([listing, ...listingsStore.get()]);
  return listing;
}

// ---- Managing your own listings --------------------------------------------------------

export class ListingError extends Error {}

/** Throws unless the listing can be deleted: no borrow of it is accepted or in progress. */
export function assertCanDelete(listing: Listing, rentals: Rental[]) {
  const active = rentals.some(
    (rental) => rental.listingId === listing.id && (rental.status === 'accepted' || rental.status === 'picked_up')
  );
  if (active) {
    throw new ListingError('It has an upcoming or active borrow. Finish or cancel that first, or pause it instead.');
  }
}

/** Returns the blocked dates with one day added or removed. */
export function toggleDate(blockedDates: string[], date: string) {
  return blockedDates.includes(date)
    ? blockedDates.filter((blocked) => blocked !== date)
    : [...blockedDates, date].sort();
}

function ownListingOrThrow(id: string) {
  const listing = getListingSnapshot(id);
  if (!listing) throw new ListingError('Listing not found.');
  if (listing.ownerId !== getCurrentUserId()) throw new ListingError('You can only change your own listings.');
  return listing;
}

function replaceListing(updated: Listing) {
  listingsStore.set(listingsStore.get().map((listing) => (listing.id === updated.id ? updated : listing)));
  return updated;
}

export async function updateListing(id: string, changes: NewListing) {
  return replaceListing({ ...ownListingOrThrow(id), ...changes });
}

export async function setListingPaused(id: string, paused: boolean) {
  return replaceListing({ ...ownListingOrThrow(id), paused });
}

export async function toggleBlockedDate(id: string, date: string) {
  const listing = ownListingOrThrow(id);
  return replaceListing({ ...listing, blockedDates: toggleDate(listing.blockedDates ?? [], date) });
}

/** Deletes a listing and declines any requests still waiting on it. */
export async function deleteListing(id: string) {
  const listing = ownListingOrThrow(id);
  assertCanDelete(listing, rentalsStore.get());
  rentalsStore.set(
    rentalsStore
      .get()
      .map((rental) => (rental.listingId === id && rental.status === 'requested' ? { ...rental, status: 'declined' } : rental))
  );
  listingsStore.set(listingsStore.get().filter((candidate) => candidate.id !== id));
}

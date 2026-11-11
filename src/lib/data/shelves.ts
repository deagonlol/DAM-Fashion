/**
 * Closet shelves: named groups of listings, like Pinterest boards. Private to their owner,
 * so the store only holds the signed-in user's shelves.
 */
import { supabase } from '../supabase';
import { toShelves, unwrap, type ShelfRow } from './rows';
import { createStore, upsertById } from './store';
import { MAX_SHELF_NAME_LENGTH, type Listing, type Shelf } from './types';

const shelvesStore = createStore<Shelf[]>([]);

export const subscribeToShelves = shelvesStore.subscribe;
export const getShelvesSnapshot = shelvesStore.get;

export function setShelves(shelves: Shelf[]) {
  shelvesStore.set(shelves);
}

/** Trims the name and checks its length. Throws a message fit to show the user. */
export function cleanShelfName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Give your shelf a name.');
  if (trimmed.length > MAX_SHELF_NAME_LENGTH) {
    throw new Error(`Shelf names can be up to ${MAX_SHELF_NAME_LENGTH} characters.`);
  }
  return trimmed;
}

/** Returns the shelves with the listing added to the front of one shelf. Adding twice is a no-op. */
export function addToShelfIn(shelves: Shelf[], shelfId: string, listingId: string): Shelf[] {
  return shelves.map((shelf) =>
    shelf.id === shelfId && !shelf.listingIds.includes(listingId)
      ? { ...shelf, listingIds: [listingId, ...shelf.listingIds] }
      : shelf
  );
}

/** Returns the shelves with the listing taken off one shelf. */
export function removeFromShelfIn(shelves: Shelf[], shelfId: string, listingId: string): Shelf[] {
  return shelves.map((shelf) =>
    shelf.id === shelfId ? { ...shelf, listingIds: shelf.listingIds.filter((id) => id !== listingId) } : shelf
  );
}

function countOf<T>(values: T[]): Map<T, number> {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/**
 * Listings that fit a shelf, best match first, like the suggestions under a Pinterest board.
 * Events and types that show up on more of the shelf's pieces count for more, so a shelf of
 * three Game Day tops leans harder toward Game Day tops than a mixed one. Brand and size are
 * tie-breakers. `candidates` should already exclude what the viewer can't borrow.
 */
export function shelfSuggestions(onShelf: Listing[], candidates: Listing[], limit: number): Listing[] {
  if (onShelf.length === 0) return [];
  const shelfIds = new Set(onShelf.map((listing) => listing.id));
  const events = countOf(onShelf.flatMap((listing) => listing.events));
  const categories = countOf(onShelf.map((listing) => listing.category));
  const brands = countOf(onShelf.map((listing) => listing.brand?.toLowerCase()).filter((brand) => !!brand));
  const sizes = countOf(onShelf.map((listing) => listing.size));

  return candidates
    .filter((listing) => !shelfIds.has(listing.id))
    .map((listing) => ({
      listing,
      score:
        listing.events.reduce((sum, event) => sum + 3 * (events.get(event) ?? 0), 0) +
        2 * (categories.get(listing.category) ?? 0) +
        (listing.brand ? (brands.get(listing.brand.toLowerCase()) ?? 0) : 0) +
        (sizes.get(listing.size) ?? 0),
      hasStyleMatch:
        listing.events.some((event) => events.has(event)) || categories.has(listing.category),
    }))
    // Size or brand alone isn't a reason to suggest something.
    .filter((match) => match.hasStyleMatch)
    .sort((a, b) => b.score - a.score || b.listing.createdAt.localeCompare(a.listing.createdAt))
    .slice(0, limit)
    .map((match) => match.listing);
}

/** Creates a shelf, optionally with a first listing on it. Returns the new shelf. */
export async function createShelf(name: string, firstListingId?: string): Promise<Shelf> {
  const row: ShelfRow = unwrap(
    await supabase.from('shelves').insert({ name: cleanShelfName(name) }).select().single()
  );
  const shelf = toShelves([row], [])[0];
  shelvesStore.set([...shelvesStore.get(), shelf]);
  if (firstListingId) await addToShelf(shelf.id, firstListingId);
  return shelf;
}

export async function renameShelf(shelfId: string, name: string) {
  const row: ShelfRow = unwrap(
    await supabase.from('shelves').update({ name: cleanShelfName(name) }).eq('id', shelfId).select().single()
  );
  const existing = shelvesStore.get().find((shelf) => shelf.id === shelfId);
  shelvesStore.set(upsertById(shelvesStore.get(), { ...toShelves([row], [])[0], listingIds: existing?.listingIds ?? [] }));
}

export async function deleteShelf(shelfId: string) {
  unwrap(await supabase.from('shelves').delete().eq('id', shelfId));
  shelvesStore.set(shelvesStore.get().filter((shelf) => shelf.id !== shelfId));
}

export async function addToShelf(shelfId: string, listingId: string) {
  const shelf = shelvesStore.get().find((s) => s.id === shelfId);
  if (shelf?.listingIds.includes(listingId)) return;
  unwrap(await supabase.from('shelf_items').insert({ shelf_id: shelfId, listing_id: listingId }));
  shelvesStore.set(addToShelfIn(shelvesStore.get(), shelfId, listingId));
}

export async function removeFromShelf(shelfId: string, listingId: string) {
  unwrap(await supabase.from('shelf_items').delete().eq('shelf_id', shelfId).eq('listing_id', listingId));
  shelvesStore.set(removeFromShelfIn(shelvesStore.get(), shelfId, listingId));
}

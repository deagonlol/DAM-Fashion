/**
 * One description of what someone is looking for. For you and a typed sentence both fill
 * this, then the same ranking orders the feed. (Photo search ranks by look instead: image-search.ts.)
 */
import type { Category, EventTag, Listing, Size } from './types';
import { CATEGORIES, EVENTS, SIZES } from './types';

export type SearchIntent = {
  categories: Category[];
  events: EventTag[];
  sizes: Size[];
  maxPrice: number | null;
  /** Leftover words such as a color. Each one must appear on a listing. */
  words: string[];
};

export type Taste = {
  events: EventTag[];
  categories: Category[];
  /** How strongly each signal counts, from hearts, shelves, and borrows. Set by tasteFromSignals. */
  weights?: {
    events: Partial<Record<EventTag, number>>;
    categories: Partial<Record<Category, number>>;
    sizes: Partial<Record<Size, number>>;
    owners: Record<string, number>;
  };
  /** Listings already hearted, so "For you" shows new things first. */
  savedIds?: string[];
};

/** What each kind of signal is worth: a heart counts more than owning something similar. */
export const SIGNAL_WEIGHTS = { saved: 3, shelved: 2, borrowed: 3, owned: 1 } as const;

const EMPTY_INTENT: SearchIntent = { categories: [], events: [], sizes: [], maxPrice: null, words: [] };

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'to',
  'and',
  'or',
  'with',
  'in',
  'of',
  'on',
  'my',
  'me',
  'i',
  'want',
  'looking',
  'something',
  'wear',
  'wearing',
  'show',
  'find',
  'need',
  'please',
  'some',
  'day',
  'per',
  'good',
  'great',
  'outfit',
  'clothes',
  'clothing',
  'item',
  'items',
  'size',
  'under',
  'below',
  'less',
  'than',
  'up',
]);

/** Longer phrases first so "semi formal" is taken before "formal". */
const EVENT_PHRASES: [string, EventTag][] = [
  ['concert and festival', 'Concert & Festival'],
  ['semi formal', 'Semi-Formal'],
  ['semiformal', 'Semi-Formal'],
  ['game day', 'Game Day'],
  ['gameday', 'Game Day'],
  ['themed party', 'Themed Party'],
  ['halloween', 'Halloween'],
  ['professional', 'Professional'],
  ['interview', 'Professional'],
  ['career', 'Professional'],
  ['concert', 'Concert & Festival'],
  ['festival', 'Concert & Festival'],
  ['western', 'Western'],
  ['cowboy', 'Western'],
  ['cowgirl', 'Western'],
  ['graduation', 'Graduation'],
  ['formal', 'Formal'],
  ['gala', 'Formal'],
];

const CATEGORY_PHRASES: [string, Category][] = [
  ['suits and blazers', 'Suits & Blazers'],
  ['blazer', 'Suits & Blazers'],
  ['blazers', 'Suits & Blazers'],
  ['suit', 'Suits & Blazers'],
  ['suits', 'Suits & Blazers'],
  ['outerwear', 'Outerwear'],
  ['jacket', 'Outerwear'],
  ['coat', 'Outerwear'],
  ['dresses', 'Dresses'],
  ['dress', 'Dresses'],
  ['gown', 'Dresses'],
  ['gowns', 'Dresses'],
  ['bottoms', 'Bottoms'],
  ['pants', 'Bottoms'],
  ['trousers', 'Bottoms'],
  ['jeans', 'Bottoms'],
  ['skirt', 'Bottoms'],
  ['shorts', 'Bottoms'],
  ['tops', 'Tops'],
  ['top', 'Tops'],
  ['shirt', 'Tops'],
  ['shirts', 'Tops'],
  ['blouse', 'Tops'],
  ['shoes', 'Shoes'],
  ['shoe', 'Shoes'],
  ['boots', 'Shoes'],
  ['heels', 'Shoes'],
  ['accessories', 'Accessories'],
  ['accessory', 'Accessories'],
  ['jewelry', 'Accessories'],
  ['earrings', 'Accessories'],
  ['costumes', 'Costumes'],
  ['costume', 'Costumes'],
];

function normalize(input: string) {
  return input
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Removes the first whole-phrase match and reports whether it was there. */
function consume(text: string, phrase: string): [boolean, string] {
  const pattern = new RegExp(`(^|\\s)${escapeRegExp(phrase)}(?=\\s|$)`);
  if (!pattern.test(text)) return [false, text];
  return [true, text.replace(pattern, ' ').replace(/\s+/g, ' ').trim()];
}

function takePhrases<T extends string>(text: string, phrases: [string, T][], allowed: readonly T[]): [T[], string] {
  const found: T[] = [];
  let rest = text;
  const ordered = [...phrases].sort((a, b) => b[0].length - a[0].length);
  for (const [phrase, value] of ordered) {
    if (!allowed.includes(value) || found.includes(value)) continue;
    const [hit, next] = consume(rest, phrase);
    if (hit) {
      found.push(value);
      rest = next;
    }
  }
  return [found, rest];
}

/** Turns a sentence into filters plus leftover words. "polo" stays a single word. */
export function parseSearchQuery(query: string): SearchIntent {
  let text = normalize(query);
  if (!text) return { ...EMPTY_INTENT };

  let maxPrice: number | null = null;
  const price = text.match(/\b(?:under|below|less than|up to)\s*\$?\s*(\d+(?:\.\d+)?)\b/);
  if (price) {
    maxPrice = Number(price[1]);
    text = text.replace(price[0], ' ').replace(/\s+/g, ' ').trim();
  }

  const [events, afterEvents] = takePhrases(text, EVENT_PHRASES, EVENTS);
  const [categories, afterCategories] = takePhrases(afterEvents, CATEGORY_PHRASES, CATEGORIES);

  const sizes: Size[] = [];
  const sizePattern = /\b(xxl|xl|xs|s|m|l)\b/g;
  let withoutSizes = afterCategories;
  for (const match of afterCategories.matchAll(sizePattern)) {
    const size = match[1].toUpperCase() as Size;
    if (SIZES.includes(size) && !sizes.includes(size)) sizes.push(size);
  }
  withoutSizes = withoutSizes.replace(sizePattern, ' ').replace(/\s+/g, ' ').trim();

  const words = withoutSizes
    .split(' ')
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word) && !word.startsWith('$'));

  return { categories, events, sizes, maxPrice, words };
}

/** Events and types from listings the viewer owns or has borrowed. */
export function tasteFromListings(listings: Listing[]): Taste {
  const events = new Set<EventTag>();
  const categories = new Set<Category>();
  for (const listing of listings) {
    categories.add(listing.category);
    for (const event of listing.events) events.add(event);
  }
  return { events: [...events], categories: [...categories] };
}

/**
 * A simple recommender: adds up the events, types, sizes, and lenders of what the viewer hearted,
 * put on shelves, borrowed, and listed, weighted by how strong each signal is.
 */
export function tasteFromSignals(signals: {
  saved: Listing[];
  shelved: Listing[];
  borrowed: Listing[];
  owned: Listing[];
}): Taste {
  const weights: NonNullable<Taste['weights']> = { events: {}, categories: {}, sizes: {}, owners: {} };
  const add = <K extends string>(map: Partial<Record<K, number>>, key: K, amount: number) => {
    map[key] = (map[key] ?? 0) + amount;
  };
  for (const kind of ['saved', 'shelved', 'borrowed', 'owned'] as const) {
    const amount = SIGNAL_WEIGHTS[kind];
    for (const listing of signals[kind]) {
      for (const event of listing.events) add(weights.events, event, amount);
      add(weights.categories, listing.category, amount);
      // Your own sizes and your own listings say little about what you'd borrow.
      if (kind !== 'owned') {
        add(weights.sizes, listing.size, amount);
        add(weights.owners, listing.ownerId, amount);
      }
    }
  }
  return {
    events: Object.keys(weights.events) as EventTag[],
    categories: Object.keys(weights.categories) as Category[],
    weights,
    savedIds: signals.saved.map((listing) => listing.id),
  };
}

/** Higher means a closer match. Zero for everyone falls through to newest. */
export function forYouScore(listing: Listing, taste: Taste, words: string[]) {
  let score = 0;
  if (taste.weights) {
    const { events, categories, sizes, owners } = taste.weights;
    for (const event of listing.events) score += events[event] ?? 0;
    score += (categories[listing.category] ?? 0) * 0.8;
    score += (sizes[listing.size] ?? 0) * 0.5;
    score += Math.min(owners[listing.ownerId] ?? 0, 6) * 0.5;
    // Already hearted: still shown, just after things you haven't seen.
    if (taste.savedIds?.includes(listing.id)) score *= 0.3;
  } else {
    for (const event of listing.events) {
      if (taste.events.includes(event)) score += 3;
    }
    if (taste.categories.includes(listing.category)) score += 2;
  }
  for (const word of words) {
    const q = word.toLowerCase();
    if (listing.title.toLowerCase().includes(q)) score += 4;
    else if (listing.description.toLowerCase().includes(q)) score += 1;
  }
  return score;
}

/**
 * Median daily price of similar listings. Needs the same type and a shared event, at least
 * three of them. Uses the same size when three of those exist. Returns null otherwise.
 */
export function suggestedDailyPrice(
  listings: Listing[],
  input: { category: Category; events: EventTag[]; size: Size; excludeId?: string }
): number | null {
  if (input.events.length === 0) return null;
  const comps = listings.filter(
    (listing) =>
      listing.id !== input.excludeId &&
      !listing.paused &&
      !listing.soldAt &&
      listing.rentable !== false &&
      listing.category === input.category &&
      listing.events.some((event) => input.events.includes(event))
  );
  const sized = comps.filter((listing) => listing.size === input.size);
  const pool = sized.length >= 3 ? sized : comps;
  if (pool.length < 3) return null;
  return Math.round(median(pool.map((listing) => listing.pricePerDay)));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median sale price of similar listings that can be bought (or were sold): same type and a
 * shared event, at least three of them. Uses the same size when three of those exist.
 */
export function suggestedSalePrice(
  listings: Listing[],
  input: { category: Category; events: EventTag[]; size: Size; excludeId?: string }
): number | null {
  if (input.events.length === 0) return null;
  const comps = listings.filter(
    (listing) =>
      listing.id !== input.excludeId &&
      listing.salePrice != null &&
      listing.category === input.category &&
      listing.events.some((event) => input.events.includes(event))
  );
  const sized = comps.filter((listing) => listing.size === input.size);
  const pool = sized.length >= 3 ? sized : comps;
  if (pool.length < 3) return null;
  return Math.round(median(pool.map((listing) => listing.salePrice!)));
}

/**
 * What a new listing probably is, from the listings that look most like its photo: the type
 * most of them share, and events at least two of them have. Nothing when there's no clear type.
 */
export function suggestFromLookalikes(lookalikes: Listing[]): { category: Category; events: EventTag[] } | null {
  if (lookalikes.length < 2) return null;
  const counts = new Map<Category, number>();
  for (const listing of lookalikes) counts.set(listing.category, (counts.get(listing.category) ?? 0) + 1);
  const [category, votes] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  // A clear majority, or at least two that agree when there are only a few.
  if (votes < 2 || votes * 2 < lookalikes.length) return null;
  const eventCounts = new Map<EventTag, number>();
  for (const listing of lookalikes.filter((item) => item.category === category)) {
    for (const event of listing.events) eventCounts.set(event, (eventCounts.get(event) ?? 0) + 1);
  }
  const events = [...eventCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([event]) => event);
  return { category, events };
}

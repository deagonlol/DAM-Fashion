import {
  forYouScore,
  parseSearchQuery,
  suggestedDailyPrice,
  suggestedSalePrice,
  suggestFromLookalikes,
  tasteFromListings,
} from '../search';
import type { Listing } from '../types';

function listing(overrides: Partial<Listing> & Pick<Listing, 'id'>): Listing {
  return {
    ownerId: 'owner',
    title: `Item ${overrides.id}`,
    description: '',
    category: 'Tops',
    events: [],
    size: 'M',
    pricePerDay: 5,
    imageUris: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('parseSearchQuery', () => {
  it('turns a sentence into type, event, price, and leftover words', () => {
    expect(parseSearchQuery('black formal dress under $15')).toEqual({
      categories: ['Dresses'],
      events: ['Formal'],
      sizes: [],
      maxPrice: 15,
      words: ['black'],
    });
  });

  it('keeps a plain keyword as a word', () => {
    expect(parseSearchQuery('polo')).toMatchObject({ words: ['polo'], categories: [], events: [], maxPrice: null });
  });

  it('matches semi-formal before formal', () => {
    expect(parseSearchQuery('semi-formal gown').events).toEqual(['Semi-Formal']);
    expect(parseSearchQuery('semi-formal gown').categories).toEqual(['Dresses']);
  });

  it('reads a size token', () => {
    expect(parseSearchQuery('size M blazer')).toMatchObject({
      categories: ['Suits & Blazers'],
      sizes: ['M'],
    });
  });
});

describe('forYouScore', () => {
  const dress = listing({
    id: 'dress',
    title: 'Black satin dress',
    category: 'Dresses',
    events: ['Formal'],
  });

  it('prefers shared events over nothing', () => {
    const taste = tasteFromListings([listing({ id: 'mine', category: 'Dresses', events: ['Formal'] })]);
    expect(forYouScore(dress, taste, [])).toBeGreaterThan(forYouScore(listing({ id: 'other' }), taste, []));
  });

  it('is zero when the viewer has no history and no words', () => {
    expect(forYouScore(dress, { events: [], categories: [] }, [])).toBe(0);
  });
});

describe('suggestedDailyPrice', () => {
  const formal = (id: string, price: number, size: Listing['size'] = 'S') =>
    listing({ id, category: 'Dresses', events: ['Formal'], size, pricePerDay: price });

  it('uses the median of the same size when there are three', () => {
    const listings = [formal('a', 10), formal('b', 20), formal('c', 30), formal('d', 100, 'L')];
    expect(suggestedDailyPrice(listings, { category: 'Dresses', events: ['Formal'], size: 'S' })).toBe(20);
  });

  it('falls back to any size in that type and event', () => {
    const listings = [formal('a', 10, 'M'), formal('b', 14, 'L'), formal('c', 18, 'S')];
    expect(suggestedDailyPrice(listings, { category: 'Dresses', events: ['Formal'], size: 'S' })).toBe(14);
  });

  it('says nothing when there are fewer than three comps', () => {
    expect(
      suggestedDailyPrice([formal('a', 10), formal('b', 12)], {
        category: 'Dresses',
        events: ['Formal'],
        size: 'S',
      })
    ).toBeNull();
  });

  it('ignores the listing being edited and paused listings', () => {
    const listings = [formal('edit', 1), formal('paused', 1), formal('a', 10), formal('b', 12), formal('c', 14)];
    listings[1].paused = true;
    expect(
      suggestedDailyPrice(listings, { category: 'Dresses', events: ['Formal'], size: 'S', excludeId: 'edit' })
    ).toBe(12);
  });
});

describe('listing suggestions', () => {
  const item = (overrides: Partial<Listing> & Pick<Listing, 'id'>): Listing => ({
    ownerId: 'owner',
    title: 'Item',
    description: '',
    category: 'Dresses',
    events: ['Formal'],
    size: 'S',
    pricePerDay: 10,
    imageUris: [],
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  });

  it('suggests the type most lookalikes share, and events at least two of them have', () => {
    const lookalikes = [
      item({ id: 'a', events: ['Formal', 'Semi-Formal'] }),
      item({ id: 'b', events: ['Formal'] }),
      item({ id: 'c', events: ['Semi-Formal', 'Graduation'] }),
      item({ id: 'd', category: 'Tops', events: ['Game Day'] }),
    ];
    expect(suggestFromLookalikes(lookalikes)).toEqual({ category: 'Dresses', events: ['Formal', 'Semi-Formal'] });
  });

  it('suggests nothing without a clear type', () => {
    expect(suggestFromLookalikes([item({ id: 'a' })])).toBeNull();
    expect(
      suggestFromLookalikes([
        item({ id: 'a' }),
        item({ id: 'b', category: 'Tops' }),
        item({ id: 'c', category: 'Shoes' }),
        item({ id: 'd', category: 'Outerwear' }),
      ])
    ).toBeNull();
  });

  it('suggests a sale price from similar items with one', () => {
    const comps = [
      item({ id: 'a', salePrice: 30 }),
      item({ id: 'b', salePrice: 40 }),
      item({ id: 'c', salePrice: 60 }),
      item({ id: 'd' }),
    ];
    expect(suggestedSalePrice(comps, { category: 'Dresses', events: ['Formal'], size: 'S' })).toBe(40);
    expect(suggestedSalePrice(comps.slice(0, 2), { category: 'Dresses', events: ['Formal'], size: 'S' })).toBeNull();
  });
});

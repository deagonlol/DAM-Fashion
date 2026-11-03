import { forYouScore, parseSearchQuery, suggestedDailyPrice, tasteFromListings } from '../search';
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
    const listings = [
      formal('edit', 1),
      formal('paused', 1),
      formal('a', 10),
      formal('b', 12),
      formal('c', 14),
    ];
    listings[1].paused = true;
    expect(
      suggestedDailyPrice(listings, { category: 'Dresses', events: ['Formal'], size: 'S', excludeId: 'edit' })
    ).toBe(12);
  });
});

import {
  EMPTY_FILTERS,
  matchesFilters,
  replacementValueError,
  replacementValueFor,
  similarListings,
  sortListings,
  trendingListings,
} from '../listings';
import type { Listing, ListingFilters } from '../types';

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

const filters = (patch: Partial<ListingFilters>): ListingFilters => ({ ...EMPTY_FILTERS, ...patch });

const polo = listing({ id: 'polo', title: 'Gameday polo', events: ['Game Day'], size: 'M', pricePerDay: 5 });
const dress = listing({
  id: 'dress',
  title: 'Satin dress',
  category: 'Dresses',
  events: ['Formal', 'Semi-Formal'],
  size: 'S',
  pricePerDay: 15,
});
const blazer = listing({
  id: 'blazer',
  title: 'Navy blazer',
  description: 'Great for formal events',
  category: 'Suits & Blazers',
  events: ['Professional'],
  size: 'L',
  pricePerDay: 10,
});
const all = [polo, dress, blazer];
const matching = (f: ListingFilters) => all.filter((item) => matchesFilters(item, f)).map((item) => item.id);

describe('matchesFilters', () => {
  it('matches everything with no filters', () => {
    expect(matching(EMPTY_FILTERS)).toEqual(['polo', 'dress', 'blazer']);
  });

  it('matches any of several selected types', () => {
    expect(matching(filters({ categories: ['Dresses', 'Suits & Blazers'] }))).toEqual(['dress', 'blazer']);
  });

  it('matches a listing if any of its events is selected', () => {
    expect(matching(filters({ events: ['Semi-Formal', 'Game Day'] }))).toEqual(['polo', 'dress']);
  });

  it('requires every filter group to match', () => {
    expect(matching(filters({ events: ['Formal', 'Professional'], sizes: ['L'] }))).toEqual(['blazer']);
    expect(matching(filters({ categories: ['Dresses'], sizes: ['L'] }))).toEqual([]);
  });

  it('applies the max price', () => {
    expect(matching(filters({ maxPrice: 10 }))).toEqual(['polo', 'blazer']);
  });

  it('searches title, description, type, and events, ignoring case', () => {
    expect(matching(filters({ query: 'POLO' }))).toEqual(['polo']);
    expect(matching(filters({ query: 'formal' }))).toEqual(['dress', 'blazer']);
    expect(matching(filters({ query: 'suits' }))).toEqual(['blazer']);
  });
});

describe('sortListings', () => {
  const dated = [
    listing({ id: 'old', pricePerDay: 3, createdAt: '2026-01-01T00:00:00Z' }),
    listing({ id: 'new', pricePerDay: 20, createdAt: '2026-03-01T00:00:00Z' }),
    listing({ id: 'mid', pricePerDay: 8, createdAt: '2026-02-01T00:00:00Z' }),
  ];
  const order = (result: Listing[]) => result.map((item) => item.id);

  it('sorts by newest', () => {
    expect(order(sortListings(dated, 'Newest', ''))).toEqual(['new', 'mid', 'old']);
  });

  it('sorts by price both ways', () => {
    expect(order(sortListings(dated, 'Price: low to high', ''))).toEqual(['old', 'mid', 'new']);
    expect(order(sortListings(dated, 'Price: high to low', ''))).toEqual(['new', 'mid', 'old']);
  });

  it('ranks event matches above description-only matches', () => {
    expect(order(sortListings([blazer, dress], 'Most relevant', 'formal'))).toEqual(['dress', 'blazer']);
  });

  it('falls back to newest when there is no search text', () => {
    expect(order(sortListings(dated, 'Most relevant', ''))).toEqual(['new', 'mid', 'old']);
  });

  it('ranks For you by the viewer’s events, then newest', () => {
    const gameday = listing({ id: 'game', events: ['Game Day'], createdAt: '2026-01-01T00:00:00Z' });
    const plain = listing({ id: 'plain', createdAt: '2026-03-01T00:00:00Z' });
    expect(
      order(sortListings([plain, gameday], 'For you', '', { taste: { events: ['Game Day'], categories: [] } }))
    ).toEqual(['game', 'plain']);
    expect(order(sortListings([plain, gameday], 'For you', ''))).toEqual(['plain', 'game']);
  });

  it('does not modify the input array', () => {
    const input = [...dated];
    sortListings(input, 'Price: low to high', '');
    expect(order(input)).toEqual(['old', 'new', 'mid']);
  });
});

describe('trendingListings', () => {
  it('puts the most-saved first, keeps the given order for ties, and stops at the limit', () => {
    const ids = (items: Listing[]) => items.map((item) => item.id);
    expect(ids(trendingListings(all, { blazer: 3, dress: 1 }, 3))).toEqual(['blazer', 'dress', 'polo']);
    expect(ids(trendingListings(all, {}, 2))).toEqual(['polo', 'dress']);
  });
});

describe('similarListings', () => {
  it('ranks same type above a shared event and skips unrelated items and itself', () => {
    const gown = listing({ id: 'gown', category: 'Dresses', events: ['Formal'] });
    const tux = listing({ id: 'tux', category: 'Suits & Blazers', events: ['Formal'] });
    const ids = similarListings(dress, [dress, polo, tux, gown], 5).map((item) => item.id);
    expect(ids).toEqual(['gown', 'tux']);
  });
});

describe('managing listings', () => {
  const { assertCanDelete, toggleDate } = jest.requireActual('../listings') as typeof import('../listings');
  const rental = (status: import('../types').RentalStatus) => ({
    id: `r-${status}`,
    listingId: 'polo',
    borrowerId: 'me',
    lenderId: 'owner',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    pickupSpot: 'Texas Union' as const,
    status,
    createdAt: '2026-10-15T00:00:00Z',
  });

  it('blocks deleting while a borrow is accepted or out', () => {
    expect(() => assertCanDelete(polo, [rental('accepted')])).toThrow('upcoming or active borrow');
    expect(() => assertCanDelete(polo, [rental('picked_up')])).toThrow('upcoming or active borrow');
  });

  it('allows deleting with only pending, finished, or cancelled borrows', () => {
    expect(() =>
      assertCanDelete(polo, [rental('requested'), rental('returned'), rental('cancelled'), rental('no_show')])
    ).not.toThrow();
  });

  it('toggles blocked dates on and off, keeping them sorted', () => {
    const once = toggleDate(['2026-10-25'], '2026-10-20');
    expect(once).toEqual(['2026-10-20', '2026-10-25']);
    expect(toggleDate(once, '2026-10-25')).toEqual(['2026-10-20']);
  });
});

describe('rent / buy filter', () => {
  const rentOnly = listing({ id: 'rent' });
  const both = listing({ id: 'both', salePrice: 40 });
  const sellOnly = listing({ id: 'sell', rentable: false, pricePerDay: 0, salePrice: 30 });
  const sold = listing({ id: 'sold', salePrice: 40, soldAt: '2026-11-01T00:00:00Z' });
  const items = [rentOnly, both, sellOnly, sold];
  const ids = (f: ListingFilters) => items.filter((item) => matchesFilters(item, f)).map((item) => item.id);

  it('shows everything by default', () => {
    expect(ids(filters({}))).toEqual(['rent', 'both', 'sell', 'sold']);
  });

  it('Rent leaves out sell-only listings', () => {
    expect(ids(filters({ deal: 'Rent' }))).toEqual(['rent', 'both', 'sold']);
  });

  it('Buy keeps only listings you can still buy', () => {
    expect(ids(filters({ deal: 'Buy' }))).toEqual(['both', 'sell']);
  });

  it('a daily price limit leaves out sell-only listings', () => {
    expect(ids(filters({ maxPrice: 100 }))).toEqual(['rent', 'both', 'sold']);
  });
});

describe('missing-item fee', () => {
  it('is the sale price when there is one', () => {
    expect(replacementValueFor({ pricePerDay: 10, salePrice: 80, replacementValue: 150 })).toBe(80);
  });

  it("is the lender's value otherwise, with no cap", () => {
    expect(replacementValueFor({ pricePerDay: 10, replacementValue: 80 })).toBe(80);
    expect(replacementValueFor({ pricePerDay: 10, replacementValue: 500 })).toBe(500);
  });

  it('defaults to 10x the daily rate for listings made before the fee existed', () => {
    expect(replacementValueFor({ pricePerDay: 10 })).toBe(100);
  });

  it('must be above the daily rate', () => {
    expect(replacementValueError(80, 10)).toBeNull();
    expect(replacementValueError(5000, 10)).toBeNull();
    expect(replacementValueError(10, 10)).not.toBeNull();
    expect(replacementValueError(Number.NaN, 10)).not.toBeNull();
  });
});

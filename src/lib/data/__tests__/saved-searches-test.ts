import { EMPTY_FILTERS } from '../listings';
import { describeSearch, hasSearchCriteria, newMatches, sameSearch, type SavedSearch } from '../saved-searches';
import type { Listing, ListingFilters } from '../types';

const f = (patch: Partial<ListingFilters>): ListingFilters => ({ ...EMPTY_FILTERS, ...patch });

const listing = (overrides: Partial<Listing> & Pick<Listing, 'id'>): Listing => ({
  ownerId: 'owner',
  title: 'Black satin dress',
  description: '',
  category: 'Dresses',
  events: ['Formal'],
  size: 'S',
  pricePerDay: 10,
  imageUris: [],
  createdAt: '2026-11-10T00:00:00Z',
  ...overrides,
});

describe('hasSearchCriteria', () => {
  it('needs text, a chip, a price limit, or rent / buy', () => {
    expect(hasSearchCriteria(EMPTY_FILTERS)).toBe(false);
    expect(hasSearchCriteria(f({ query: '  ' }))).toBe(false);
    expect(hasSearchCriteria(f({ query: 'dress' }))).toBe(true);
    expect(hasSearchCriteria(f({ sizes: ['S'] }))).toBe(true);
    expect(hasSearchCriteria(f({ deal: 'Buy' }))).toBe(true);
  });
});

describe('sameSearch', () => {
  it('ignores order, case and extra spaces', () => {
    expect(
      sameSearch(f({ query: 'Black Dress ', sizes: ['S', 'M'] }), f({ query: 'black dress', sizes: ['M', 'S'] }))
    ).toBe(true);
    expect(sameSearch(f({ query: 'dress' }), f({ query: 'dress', deal: 'Rent' }))).toBe(false);
  });
});

describe('describeSearch', () => {
  it('names a search from what was typed and picked', () => {
    expect(describeSearch(f({ query: 'black dress', sizes: ['S'], maxPrice: 15 }))).toBe('black dress · S · under $15');
    expect(describeSearch(f({ events: ['Game Day'], deal: 'Buy' }))).toBe('Game Day · to buy');
  });
});

describe('newMatches', () => {
  const search: SavedSearch = {
    id: 's1',
    label: 'black dress',
    filters: f({ query: 'black', sizes: ['S'] }),
    lastSeenAt: '2026-11-10T12:00:00Z',
    createdAt: '2026-11-01T00:00:00Z',
  };

  it('counts matching listings posted since the search was last opened', () => {
    const old = listing({ id: 'old', createdAt: '2026-11-10T08:00:00Z' });
    const fresh = listing({ id: 'fresh', createdAt: '2026-11-11T08:00:00Z' });
    const wrongSize = listing({ id: 'big', size: 'L', createdAt: '2026-11-11T09:00:00Z' });
    expect(newMatches(search, [old, fresh, wrongSize]).map((l) => l.id)).toEqual(['fresh']);
  });
});

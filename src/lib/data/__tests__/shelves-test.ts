import { toShelves } from '../rows';
import { addToShelfIn, cleanShelfName, removeFromShelfIn, shelfSuggestions } from '../shelves';
import type { Listing, Shelf } from '../types';

const shelf = (overrides: Partial<Shelf> & Pick<Shelf, 'id'>): Shelf => ({
  ownerId: 'me',
  name: `Shelf ${overrides.id}`,
  listingIds: [],
  createdAt: '2026-11-10T00:00:00Z',
  ...overrides,
});

describe('addToShelfIn', () => {
  it('puts the listing at the front of that shelf only', () => {
    const shelves = [shelf({ id: 'a', listingIds: ['x'] }), shelf({ id: 'b' })];
    const next = addToShelfIn(shelves, 'a', 'y');
    expect(next[0].listingIds).toEqual(['y', 'x']);
    expect(next[1].listingIds).toEqual([]);
  });

  it('does nothing when the listing is already on the shelf', () => {
    const shelves = [shelf({ id: 'a', listingIds: ['x'] })];
    expect(addToShelfIn(shelves, 'a', 'x')[0].listingIds).toEqual(['x']);
  });
});

describe('removeFromShelfIn', () => {
  it('takes the listing off that shelf and leaves other shelves alone', () => {
    const shelves = [shelf({ id: 'a', listingIds: ['x', 'y'] }), shelf({ id: 'b', listingIds: ['x'] })];
    const next = removeFromShelfIn(shelves, 'a', 'x');
    expect(next[0].listingIds).toEqual(['y']);
    expect(next[1].listingIds).toEqual(['x']);
  });
});

describe('cleanShelfName', () => {
  it('trims the name', () => {
    expect(cleanShelfName('  Game day  ')).toBe('Game day');
  });

  it('rejects blank and overlong names', () => {
    expect(() => cleanShelfName('   ')).toThrow('Give your shelf a name.');
    expect(() => cleanShelfName('x'.repeat(41))).toThrow('up to 40 characters');
  });
});

describe('toShelves', () => {
  it('groups items under their shelf, newest first', () => {
    const shelves = toShelves(
      [{ id: 'a', owner_id: 'me', name: 'Formal', created_at: '2026-11-01T00:00:00Z' }],
      [
        { shelf_id: 'a', listing_id: 'old', created_at: '2026-11-02T00:00:00Z' },
        { shelf_id: 'other', listing_id: 'z', created_at: '2026-11-03T00:00:00Z' },
        { shelf_id: 'a', listing_id: 'new', created_at: '2026-11-04T00:00:00Z' },
      ]
    );
    expect(shelves).toEqual([
      { id: 'a', ownerId: 'me', name: 'Formal', createdAt: '2026-11-01T00:00:00Z', listingIds: ['new', 'old'] },
    ]);
  });
});

describe('shelfSuggestions', () => {
  const item = (overrides: Partial<Listing> & Pick<Listing, 'id'>): Listing => ({
    ownerId: 'owner',
    title: `Item ${overrides.id}`,
    description: '',
    category: 'Tops',
    events: [],
    size: 'M',
    pricePerDay: 5,
    imageUris: [],
    createdAt: '2026-11-01T00:00:00Z',
    ...overrides,
  });

  const jersey = item({ id: 'jersey', events: ['Game Day'] });
  const tee = item({ id: 'tee', events: ['Game Day'], size: 'S' });
  const gown = item({ id: 'gown', category: 'Dresses', events: ['Formal'] });
  const polo = item({ id: 'polo', events: ['Game Day'] });
  const cowboyHat = item({ id: 'hat', category: 'Accessories', events: ['Western'] });
  const mSizedDress = item({ id: 'dress', category: 'Dresses', events: ['Formal'], size: 'M' });

  it('suggests what fits the shelf, leaving out what is already on it', () => {
    const ids = shelfSuggestions([jersey, tee], [jersey, polo, gown, cowboyHat], 10).map((l) => l.id);
    expect(ids).toEqual(['polo']);
  });

  it('weights what most of the shelf has in common', () => {
    // Two Game Day tops and one formal dress: more Game Day tops beat another dress.
    const ids = shelfSuggestions([jersey, tee, gown], [mSizedDress, polo], 10).map((l) => l.id);
    expect(ids).toEqual(['polo', 'dress']);
  });

  it('ignores matches on size alone', () => {
    expect(shelfSuggestions([jersey], [item({ id: 'x', category: 'Shoes' })], 10)).toEqual([]);
  });

  it('suggests nothing for an empty shelf', () => {
    expect(shelfSuggestions([], [polo], 10)).toEqual([]);
  });
});

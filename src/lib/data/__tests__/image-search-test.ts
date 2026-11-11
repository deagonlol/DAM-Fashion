import { rankByMatches } from '../image-search';
import type { Listing } from '../types';

jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));

const listing = (id: string) => ({ id }) as Listing;

describe('rankByMatches', () => {
  const listings = [listing('a'), listing('b'), listing('c')];

  it('orders listings by similarity, closest first', () => {
    const ranked = rankByMatches(
      listings,
      [
        { listingId: 'b', similarity: 0.7 },
        { listingId: 'c', similarity: 0.9 },
        { listingId: 'a', similarity: 0.8 },
      ],
      { minSimilarity: 0, window: 1 }
    );
    expect(ranked.map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('ignores listings the viewer cannot see, even when they match best', () => {
    const ranked = rankByMatches(listings, [
      { listingId: 'hidden', similarity: 0.95 },
      { listingId: 'a', similarity: 0.62 },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['a']);
  });

  it('keeps matches close to the best one and drops the rest', () => {
    const ranked = rankByMatches(listings, [
      { listingId: 'a', similarity: 0.88 },
      { listingId: 'b', similarity: 0.7 },
      { listingId: 'c', similarity: 0.6 },
    ]);
    expect(ranked.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('shows nothing when even the best match looks unrelated', () => {
    expect(rankByMatches(listings, [{ listingId: 'a', similarity: 0.4 }])).toEqual([]);
  });
});

import {
  addReply,
  averageRating,
  canReview,
  createReview,
  isReviewVisible,
  reviewDaysLeft,
  visibleReviewsAbout,
} from '../reviews';
import type { Rental, Review } from '../types';

const returnedAt = '2026-10-01T12:00:00.000Z';
const duringWindow = new Date('2026-10-05T12:00:00Z');
const afterWindow = new Date('2026-10-16T12:00:00Z'); // 15 days after return

const rental: Rental = {
  id: 'r1',
  listingId: 'a',
  borrowerId: 'borrower',
  lenderId: 'lender',
  startDate: '2026-09-30',
  endDate: '2026-10-01',
  pickupSpot: 'Texas Union',
  status: 'returned',
  createdAt: '2026-09-25T00:00:00Z',
  returnedAt,
};

const input = { rentalId: 'r1', rating: 5, tags: [], comment: 'Great!' };

function review(reviewerId: 'borrower' | 'lender', overrides: Partial<Review> = {}): Review {
  return createReview(rental, reviewerId, [], { ...input, ...overrides }, duringWindow);
}

describe('who can review, and when', () => {
  it('lets both people review a returned borrow during the window', () => {
    expect(canReview(rental, 'borrower', [], duringWindow)).toBe(true);
    expect(canReview(rental, 'lender', [], duringWindow)).toBe(true);
  });

  it("blocks outsiders, unreturned borrows, and repeat reviews", () => {
    expect(canReview(rental, 'stranger', [], duringWindow)).toBe(false);
    expect(canReview({ ...rental, status: 'picked_up' }, 'borrower', [], duringWindow)).toBe(false);
    expect(canReview(rental, 'borrower', [review('borrower')], duringWindow)).toBe(false);
    expect(canReview(rental, 'lender', [review('borrower')], duringWindow)).toBe(true);
  });

  it('closes 14 days after the return', () => {
    expect(reviewDaysLeft(rental, duringWindow)).toBe(10);
    expect(canReview(rental, 'borrower', [], afterWindow)).toBe(false);
    expect(() => createReview(rental, 'borrower', [], input, afterWindow)).toThrow('14 days');
  });
});

describe('createReview', () => {
  it('reviews the other person in the right role', () => {
    expect(review('borrower')).toMatchObject({ revieweeId: 'lender', revieweeRole: 'lender' });
    expect(review('lender')).toMatchObject({ revieweeId: 'borrower', revieweeRole: 'borrower' });
  });

  it('requires a whole-star rating from 1 to 5', () => {
    for (const rating of [0, 6, 4.5]) {
      expect(() => review('borrower', { rating })).toThrow('1 to 5');
    }
  });

  it('only allows tags that fit the role', () => {
    expect(review('borrower', { tags: ['As described'] }).tags).toEqual(['As described']);
    expect(() => review('borrower', { tags: ['On time'] })).toThrow('tags');
    expect(review('lender', { tags: ['On time', 'On time'] }).tags).toEqual(['On time']);
  });

  it('trims comments and caps their length', () => {
    expect(review('borrower', { comment: '  Nice  ' }).comment).toBe('Nice');
    expect(() => review('borrower', { comment: 'x'.repeat(501) })).toThrow('500');
  });
});

describe('double-blind visibility', () => {
  const fromBorrower = review('borrower');
  const fromLender = review('lender');

  it('hides a review until the other person reviews too', () => {
    expect(isReviewVisible(fromBorrower, [fromBorrower], [rental], duringWindow)).toBe(false);
    const both = [fromBorrower, fromLender];
    expect(isReviewVisible(fromBorrower, both, [rental], duringWindow)).toBe(true);
    expect(isReviewVisible(fromLender, both, [rental], duringWindow)).toBe(true);
  });

  it('shows a one-sided review once the window closes', () => {
    expect(isReviewVisible(fromBorrower, [fromBorrower], [rental], afterWindow)).toBe(true);
  });

  it('lists only public reviews about a person, newest first', () => {
    const older = { ...fromLender, id: 'old', rentalId: 'r0', createdAt: '2026-09-01T00:00:00Z' };
    const oldRental = { ...rental, id: 'r0', returnedAt: '2026-08-01T00:00:00Z' };
    const result = visibleReviewsAbout('borrower', [fromLender, older], [rental, oldRental], duringWindow);
    // fromLender is hidden (borrower hasn't reviewed); the old one is past its window.
    expect(result.map((item) => item.id)).toEqual(['old']);
  });
});

describe('replies', () => {
  const fromBorrower = review('borrower');
  const fromLender = review('lender');
  const both = [fromBorrower, fromLender];

  it('lets the reviewed person reply once to a public review', () => {
    const replied = addReply(fromBorrower, 'lender', ' Thanks! ', both, [rental], duringWindow);
    expect(replied.reply?.text).toBe('Thanks!');
    expect(() => addReply(replied, 'lender', 'Again', both, [rental], duringWindow)).toThrow('already replied');
  });

  it("blocks replies from others, to hidden reviews, and empty replies", () => {
    expect(() => addReply(fromBorrower, 'borrower', 'Hi', both, [rental], duringWindow)).toThrow('person reviewed');
    expect(() => addReply(fromBorrower, 'lender', 'Hi', [fromBorrower], [rental], duringWindow)).toThrow('public');
    expect(() => addReply(fromBorrower, 'lender', '   ', both, [rental], duringWindow)).toThrow('Write a reply');
  });
});

describe('averageRating', () => {
  it('averages to one decimal, or null with no reviews', () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([review('borrower', { rating: 5 }), review('lender', { rating: 4 })])).toBe(4.5);
    expect(
      averageRating([review('borrower', { rating: 5 }), review('lender', { rating: 4 }), review('lender', { rating: 4 })])
    ).toBe(4.3);
  });
});

import { badgesFor } from '../badges';
import type { Strike } from '../moderation';
import type { Rental, Review } from '../types';

const now = new Date('2026-10-16T12:00:00');

let id = 0;
function returned(role: 'lender' | 'borrower', overrides: Partial<Rental> = {}): Rental {
  id += 1;
  return {
    id: `r${id}`,
    listingId: 'a',
    borrowerId: role === 'borrower' ? 'me' : 'other',
    lenderId: role === 'lender' ? 'me' : 'other',
    startDate: '2026-09-01',
    endDate: '2026-09-02',
    pickupSpot: 'Texas Union',
    status: 'returned',
    createdAt: '2026-08-30T00:00:00Z',
    returnedAt: '2026-09-02T18:00:00Z',
    ...overrides,
  };
}

function review(rating: number, revieweeRole: 'lender' | 'borrower' = 'lender'): Review {
  id += 1;
  return {
    id: `rv${id}`,
    rentalId: 'r',
    reviewerId: 'other',
    revieweeId: 'me',
    revieweeRole,
    rating,
    tags: [],
    comment: '',
    createdAt: '2026-09-03T00:00:00Z',
  };
}

const strike: Strike = { userId: 'me', source: 'no_show', refId: 'r', at: '2026-10-01T00:00:00Z' };
const times = <T,>(n: number, make: () => T) => Array.from({ length: n }, make);
const badges = (rentals: Rental[], reviews: Review[] = [], strikes: Strike[] = [], isVerifiedStudent = true) =>
  badgesFor({ userId: 'me', isVerifiedStudent, rentals, reviews, strikes, now });

describe('badgesFor', () => {
  it('gives every UT email the verified badge', () => {
    expect(badges([])).toEqual(['verified_student']);
    expect(badges([], [], [], false)).toEqual([]);
  });

  it('awards First lend after one lend, then Trusted lender at five', () => {
    expect(badges([returned('lender')])).toContain('first_lend');
    const five = times(5, () => returned('lender'));
    expect(badges(five)).toContain('trusted_lender');
    expect(badges(five)).not.toContain('first_lend');
  });

  it('withholds Trusted lender with a low lender rating', () => {
    const five = times(5, () => returned('lender'));
    expect(badges(five, [review(4), review(4)])).not.toContain('trusted_lender');
    expect(badges(five, [review(5), review(4)])).toContain('trusted_lender');
  });

  it('awards On-time returner after 3 borrows with none late', () => {
    expect(badges(times(2, () => returned('borrower')))).not.toContain('on_time');
    expect(badges(times(3, () => returned('borrower')))).toContain('on_time');
  });

  it('loses On-time returner after any late return, or while an item is overdue', () => {
    const onTime = times(3, () => returned('borrower'));
    expect(badges([...onTime, returned('borrower', { returnedLate: true })])).not.toContain('on_time');
    const overdue = returned('borrower', { status: 'picked_up', endDate: '2026-10-10', returnedAt: undefined });
    expect(badges([...onTime, overdue])).not.toContain('on_time');
  });

  it('awards Top rated for 3+ reviews averaging 4.8+', () => {
    expect(badges([], [review(5), review(5)])).not.toContain('top_rated');
    expect(badges([], [review(5), review(5), review(5, 'borrower')])).toContain('top_rated');
    expect(badges([], [review(5), review(5), review(4)])).not.toContain('top_rated');
  });

  it('removes every trust badge while the user has a strike, keeping milestones', () => {
    const record = [...times(5, () => returned('lender')), ...times(3, () => returned('borrower'))];
    const reviews = [review(5), review(5), review(5)];
    expect(badges(record, reviews)).toEqual(['verified_student', 'trusted_lender', 'on_time', 'top_rated']);
    // First lend is a milestone, not a trust signal, so it stays.
    expect(badges(record, reviews, [strike])).toEqual(['verified_student', 'first_lend']);
  });
});

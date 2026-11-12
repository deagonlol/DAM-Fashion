import { changedTerms, openProposal, proposalKind, termsOf, type BorrowTerms } from '../proposals';
import type { Rental, RentalProposal } from '../types';

const rental = (overrides: Partial<Rental> = {}): Rental => ({
  id: 'r1',
  listingId: 'l1',
  borrowerId: 'borrower',
  lenderId: 'lender',
  startDate: '2026-11-14',
  endDate: '2026-11-15',
  pickupSpot: 'Texas Union',
  pickupTime: '16:00',
  returnTime: '12:00',
  status: 'requested',
  createdAt: '2026-11-10T00:00:00Z',
  ...overrides,
});

const proposal = (overrides: Partial<RentalProposal> = {}): RentalProposal => ({
  id: 'p1',
  rentalId: 'r1',
  proposerId: 'lender',
  startDate: '2026-11-14',
  endDate: '2026-11-15',
  pickupTime: '16:00',
  returnTime: '12:00',
  pickupSpot: 'Texas Union',
  pricePerDay: 5,
  note: '',
  status: 'pending',
  createdAt: '2026-11-10T01:00:00Z',
  ...overrides,
});

describe('proposalKind', () => {
  it('lets the borrower edit and the lender counter a waiting request', () => {
    expect(proposalKind(rental(), 'borrower')).toBe('edit');
    expect(proposalKind(rental(), 'lender')).toBe('counter');
  });

  it('lets either person change the plans of a confirmed borrow', () => {
    expect(proposalKind(rental({ status: 'accepted' }), 'borrower')).toBe('change');
    expect(proposalKind(rental({ status: 'accepted' }), 'lender')).toBe('change');
  });

  it('allows no changes after pickup or once it has ended', () => {
    for (const status of ['picked_up', 'returned', 'declined', 'cancelled', 'no_show'] as const) {
      expect(proposalKind(rental({ status }), 'borrower')).toBeNull();
    }
  });
});

describe('termsOf and changedTerms', () => {
  it('uses the offered price, falling back to the listing price', () => {
    expect(termsOf(rental({ offeredPricePerDay: 7 }), 5).pricePerDay).toBe(7);
    expect(termsOf(rental(), 5).pricePerDay).toBe(5);
  });

  it('lists only the terms that differ', () => {
    const current: BorrowTerms = termsOf(rental(), 5);
    expect(changedTerms(current, { ...current })).toEqual([]);
    expect(changedTerms(current, { ...current, pickupTime: '17:00', pricePerDay: 4 })).toEqual([
      'pickupTime',
      'pricePerDay',
    ]);
  });

  it('treats a missing time and an unset time as the same', () => {
    const current = termsOf(rental({ pickupTime: undefined }), 5);
    expect(changedTerms(current, { ...current, pickupTime: undefined })).toEqual([]);
  });
});

describe('openProposal', () => {
  it('finds the pending proposal for the borrow, ignoring answered ones', () => {
    const old = proposal({ id: 'old', status: 'declined' });
    const open = proposal({ id: 'open' });
    const elsewhere = proposal({ id: 'other', rentalId: 'r2' });
    expect(openProposal([old, open, elsewhere], 'r1')).toBe(open);
    expect(openProposal([old], 'r1')).toBeUndefined();
  });
});

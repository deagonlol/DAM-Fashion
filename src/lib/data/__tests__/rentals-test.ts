import {
  accept,
  borrowCount,
  borrowedListings,
  canReportIssue,
  canReportNoShow,
  cancel,
  confirmPickup,
  confirmReturn,
  daysOverdue,
  decline,
  isOverdue,
  lendCount,
  rangesOverlap,
  rentalDays,
  RentalError,
  reportIssue,
  reportNoShow,
  validateRequest,
} from '../rentals';
import type { Listing, Rental, RentalStatus } from '../types';

function listing(id: string, ownerId = 'lender'): Listing {
  return {
    id,
    ownerId,
    title: `Item ${id}`,
    description: '',
    category: 'Tops',
    events: [],
    size: 'M',
    pricePerDay: 5,
    imageUris: [],
    createdAt: '2026-01-01T00:00:00Z',
  };
}

let nextRentalId = 0;
function rental(overrides: Partial<Rental> = {}): Rental {
  nextRentalId += 1;
  return {
    id: `r${nextRentalId}`,
    listingId: 'a',
    borrowerId: 'me',
    lenderId: 'lender',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    pickupSpot: 'Texas Union',
    status: 'requested',
    createdAt: '2026-10-15T12:00:00Z',
    ...overrides,
  };
}

const CODES = { pickupCode: '1111', returnCode: '2222' };
const local = (iso: string) => new Date(iso); // no "Z": parsed as local time, like due dates
const listings = ['a', 'b', 'c'].map((id) => listing(id));
const ids = (result: Listing[]) => result.map((item) => item.id);

describe('dates', () => {
  it('counts inclusive days', () => {
    expect(rentalDays('2026-10-20', '2026-10-20')).toBe(1);
    expect(rentalDays('2026-10-20', '2026-10-22')).toBe(3);
    expect(rentalDays('2026-10-31', '2026-11-01')).toBe(2);
  });

  it('detects overlapping ranges, including touching on one day', () => {
    expect(rangesOverlap('2026-10-20', '2026-10-21', '2026-10-21', '2026-10-23')).toBe(true);
    expect(rangesOverlap('2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23')).toBe(false);
    expect(rangesOverlap('2026-10-18', '2026-10-25', '2026-10-20', '2026-10-21')).toBe(true);
  });
});

describe('validateRequest', () => {
  const today = '2026-10-16';
  const request = { listingId: 'a', startDate: '2026-10-20', endDate: '2026-10-21', pickupSpot: 'Texas Union' as const };

  it('allows a normal request', () => {
    expect(() => validateRequest([], listings[0], 'me', request, today)).not.toThrow();
  });

  it("blocks borrowing your own item", () => {
    expect(() => validateRequest([], listing('a', 'me'), 'me', request, today)).toThrow("can't borrow your own");
  });

  it('blocks past dates, backwards ranges, and borrows over 14 days', () => {
    expect(() => validateRequest([], listings[0], 'me', { ...request, startDate: '2026-10-15' }, today)).toThrow(
      'from today on'
    );
    expect(() => validateRequest([], listings[0], 'me', { ...request, endDate: '2026-10-19' }, today)).toThrow(
      'on or after'
    );
    expect(() => validateRequest([], listings[0], 'me', { ...request, endDate: '2026-11-03' }, today)).toThrow(
      'at most 14'
    );
  });

  it('allows a same-day borrow starting today', () => {
    expect(() =>
      validateRequest([], listings[0], 'me', { ...request, startDate: today, endDate: today }, today)
    ).not.toThrow();
  });

  it('blocks a second open borrow of the same item by the same person', () => {
    for (const status of ['requested', 'accepted', 'picked_up'] as RentalStatus[]) {
      const existing = [rental({ status, startDate: '2026-11-01', endDate: '2026-11-02' })];
      expect(() => validateRequest(existing, listings[0], 'me', request, today)).toThrow('already have an open');
    }
  });

  it('allows borrowing the same item again after the last borrow ended', () => {
    for (const status of ['returned', 'declined', 'cancelled', 'no_show'] as RentalStatus[]) {
      const existing = [rental({ status })];
      expect(() => validateRequest(existing, listings[0], 'me', request, today)).not.toThrow();
    }
  });

  it("blocks dates overlapping someone else's accepted or active borrow", () => {
    const booked = [rental({ borrowerId: 'other', status: 'accepted', startDate: '2026-10-21', endDate: '2026-10-22' })];
    expect(() => validateRequest(booked, listings[0], 'me', request, today)).toThrow('already booked');
  });

  it("doesn't let pending requests from others block dates", () => {
    const pending = [rental({ borrowerId: 'other', status: 'requested' })];
    expect(() => validateRequest(pending, listings[0], 'me', request, today)).not.toThrow();
  });
});

describe('lifecycle', () => {
  const now = local('2026-10-20T12:00:00');

  it('runs request → accept → pickup → return', () => {
    const requested = rental();
    const accepted = accept([requested], requested, 'lender', CODES);
    expect(accepted.status).toBe('accepted');
    const pickedUp = confirmPickup(accepted, 'me', '1111', now);
    expect(pickedUp.status).toBe('picked_up');
    const returned = confirmReturn(pickedUp, 'lender', '2222', now);
    expect(returned.status).toBe('returned');
    expect(returned.returnedAt).toBe(now.toISOString());
  });

  it('only lets the lender accept or decline, and only while requested', () => {
    const requested = rental();
    expect(() => accept([requested], requested, 'me', CODES)).toThrow('Only the lender');
    expect(() => decline(requested, 'me')).toThrow('Only the lender');
    const declined = decline(requested, 'lender');
    expect(declined.status).toBe('declined');
    expect(() => accept([declined], declined, 'lender', CODES)).toThrow('no longer waiting');
  });

  it('refuses to accept two borrows for overlapping dates', () => {
    const first = rental({ borrowerId: 'other', status: 'accepted' });
    const second = rental({ startDate: '2026-10-21', endDate: '2026-10-22' });
    expect(() => accept([first, second], second, 'lender', CODES)).toThrow('already accepted another');
  });

  it('lets the borrower cancel before pickup but not after', () => {
    expect(cancel(rental(), 'me').status).toBe('cancelled');
    expect(cancel(rental({ status: 'accepted' }), 'me').status).toBe('cancelled');
    expect(() => cancel(rental({ status: 'picked_up' }), 'me')).toThrow("can't be cancelled");
    expect(() => cancel(rental(), 'lender')).toThrow('Only the borrower');
  });

  it('rejects wrong handoff codes and the wrong person entering them', () => {
    const accepted = rental({ status: 'accepted', ...CODES });
    expect(() => confirmPickup(accepted, 'me', '9999', now)).toThrow("doesn't match");
    expect(() => confirmPickup(accepted, 'lender', '1111', now)).toThrow('borrower enters');
    expect(confirmPickup(accepted, 'me', ' 1111 ', now).status).toBe('picked_up');

    const out = rental({ status: 'picked_up', ...CODES });
    expect(() => confirmReturn(out, 'lender', '1111', now)).toThrow("doesn't match");
    expect(() => confirmReturn(out, 'me', '2222', now)).toThrow('lender enters');
  });

  it("can't skip steps", () => {
    expect(() => confirmPickup(rental({ ...CODES }), 'me', '1111', now)).toThrow("isn't waiting for pickup");
    expect(() => confirmReturn(rental({ status: 'accepted', ...CODES }), 'lender', '2222', now)).toThrow(
      "isn't out"
    );
  });
});

describe('late returns', () => {
  const out = rental({ status: 'picked_up', endDate: '2026-10-21' });

  it('is not late on the return date or within the 2-hour grace period', () => {
    expect(isOverdue(out, local('2026-10-21T22:00:00'))).toBe(false);
    expect(isOverdue(out, local('2026-10-22T01:30:00'))).toBe(false);
  });

  it('is late after the grace period, counting whole days', () => {
    expect(isOverdue(out, local('2026-10-22T02:30:00'))).toBe(true);
    expect(daysOverdue(out, local('2026-10-22T02:30:00'))).toBe(1);
    expect(daysOverdue(out, local('2026-10-25T12:00:00'))).toBe(3);
  });

  it('only applies while the item is out', () => {
    expect(isOverdue({ ...out, status: 'returned' }, local('2026-10-30T12:00:00'))).toBe(false);
    expect(daysOverdue({ ...out, status: 'returned' }, local('2026-10-30T12:00:00'))).toBe(0);
  });
});

describe('no-shows', () => {
  const accepted = rental({ status: 'accepted', startDate: '2026-10-20' });

  it('can be reported by either person once the pickup day starts', () => {
    expect(canReportNoShow(accepted, local('2026-10-19T23:00:00'))).toBe(false);
    expect(reportNoShow(accepted, 'lender', local('2026-10-20T09:00:00'))).toMatchObject({
      status: 'no_show',
      noShowReportedBy: 'lender',
    });
    expect(reportNoShow(accepted, 'me', local('2026-10-20T09:00:00')).noShowReportedBy).toBe('me');
  });

  it("can't be reported early, by outsiders, or after pickup", () => {
    expect(() => reportNoShow(accepted, 'me', local('2026-10-19T09:00:00'))).toThrow('pickup day has started');
    expect(() => reportNoShow(accepted, 'stranger', local('2026-10-20T09:00:00'))).toThrow('Only people');
    expect(() => reportNoShow({ ...accepted, status: 'picked_up' }, 'me', local('2026-10-20T09:00:00'))).toThrow(
      RentalError
    );
  });
});

describe('condition issues', () => {
  const returned = rental({ status: 'returned', returnedAt: '2026-10-21T18:00:00.000Z' });

  it('lets the lender report within 24 hours of the return', () => {
    expect(reportIssue(returned, 'lender', ' Stain on sleeve ', new Date('2026-10-22T10:00:00Z')).conditionIssue).toBe(
      'Stain on sleeve'
    );
  });

  it('closes after 24 hours, and allows only one report', () => {
    expect(canReportIssue(returned, new Date('2026-10-22T19:00:00Z'))).toBe(false);
    expect(canReportIssue({ ...returned, conditionIssue: 'x' }, new Date('2026-10-21T19:00:00Z'))).toBe(false);
  });

  it('requires the lender and a description', () => {
    expect(() => reportIssue(returned, 'me', 'stain', new Date('2026-10-21T19:00:00Z'))).toThrow('Only the lender');
    expect(() => reportIssue(returned, 'lender', '  ', new Date('2026-10-21T19:00:00Z'))).toThrow('Describe');
  });
});

describe('borrowedListings', () => {
  const borrowed = (listingId: string, startDate: string, status: RentalStatus = 'returned') =>
    rental({ listingId, startDate, endDate: startDate, status });

  it('returns nothing when the user has never borrowed', () => {
    expect(borrowedListings([], listings, 'me')).toEqual([]);
    expect(borrowedListings([{ ...borrowed('a', '2026-10-01'), borrowerId: 'someone-else' }], listings, 'me')).toEqual(
      []
    );
  });

  it('lists different items, most recently borrowed first', () => {
    const rentals = [borrowed('a', '2026-09-01'), borrowed('c', '2026-10-01'), borrowed('b', '2026-09-15')];
    expect(ids(borrowedListings(rentals, listings, 'me'))).toEqual(['c', 'b', 'a']);
  });

  it('shows an item borrowed several times only once, placed by its latest borrow', () => {
    const rentals = [borrowed('a', '2026-09-01'), borrowed('b', '2026-09-15'), borrowed('a', '2026-10-01')];
    expect(ids(borrowedListings(rentals, listings, 'me'))).toEqual(['a', 'b']);
  });

  it('handles several items each borrowed several times, in any input order', () => {
    const rentals = [
      borrowed('b', '2026-09-10'),
      borrowed('a', '2026-08-01'),
      borrowed('c', '2026-09-05'),
      borrowed('b', '2026-08-20'),
      borrowed('a', '2026-09-30'),
      borrowed('c', '2026-07-01'),
    ];
    expect(ids(borrowedListings(rentals, listings, 'me'))).toEqual(['a', 'b', 'c']);
  });

  it('counts items currently out, but not requests that never happened', () => {
    const rentals = [
      borrowed('a', '2026-10-01', 'picked_up'),
      borrowed('b', '2026-10-02', 'requested'),
      borrowed('c', '2026-10-03', 'cancelled'),
      borrowed('c', '2026-10-04', 'no_show'),
    ];
    expect(ids(borrowedListings(rentals, listings, 'me'))).toEqual(['a']);
  });

  it('skips borrows of listings that no longer exist', () => {
    const rentals = [borrowed('deleted', '2026-10-01'), borrowed('b', '2026-09-01')];
    expect(ids(borrowedListings(rentals, listings, 'me'))).toEqual(['b']);
  });

  it('does not modify the rentals array it is given', () => {
    const rentals = [borrowed('a', '2026-09-01'), borrowed('b', '2026-10-01')];
    const before = rentals.map((item) => item.id);
    borrowedListings(rentals, listings, 'me');
    expect(rentals.map((item) => item.id)).toEqual(before);
  });
});

describe('borrowCount and lendCount', () => {
  it('count completed borrows and lends, including repeats of the same item', () => {
    const rentals = [
      rental({ status: 'returned' }),
      rental({ status: 'returned' }),
      rental({ status: 'picked_up' }),
      rental({ status: 'cancelled' }),
      rental({ borrowerId: 'other', status: 'returned' }),
    ];
    expect(borrowCount(rentals, 'me')).toBe(2);
    expect(lendCount(rentals, 'lender')).toBe(3);
    expect(borrowCount(rentals, 'nobody')).toBe(0);
  });
});

describe('availability set by the owner', () => {
  const today = '2026-10-16';
  const request = { listingId: 'a', startDate: '2026-10-20', endDate: '2026-10-22', pickupSpot: 'Texas Union' as const };

  it("blocks requests for paused listings", () => {
    expect(() => validateRequest([], { ...listings[0], paused: true }, 'me', request, today)).toThrow("isn't available");
  });

  it('blocks requests touching a day the owner blocked off', () => {
    expect(() => validateRequest([], { ...listings[0], blockedDates: ['2026-10-22'] }, 'me', request, today)).toThrow(
      "isn't lending it"
    );
    expect(() =>
      validateRequest([], { ...listings[0], blockedDates: ['2026-10-19', '2026-10-23'] }, 'me', request, today)
    ).not.toThrow();
  });
});

describe('recording late returns', () => {
  const out = rental({ status: 'picked_up', endDate: '2026-10-21', ...CODES });

  it('marks a return late only after the grace period', () => {
    expect(confirmReturn(out, 'lender', '2222', local('2026-10-22T01:00:00')).returnedLate).toBe(false);
    expect(confirmReturn(out, 'lender', '2222', local('2026-10-22T03:00:00')).returnedLate).toBe(true);
  });
});

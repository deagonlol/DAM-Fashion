import {
  accept,
  bookedDays,
  isAvailableOn,
  openOfferCount,
  borrowCount,
  borrowedListings,
  canReportIssue,
  canReportNoShow,
  cancel,
  confirmPickup,
  confirmReturn,
  daysOverdue,
  daysUntilDue,
  decline,
  formatRemainingTime,
  isOverdue,
  lendCount,
  orderStage,
  orderStatus,
  pickRange,
  dragRange,
  ordersFor,
  codeToShow,
  isExpiredRequest,
  MEETING_TIMES,
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
  const request = {
    listingId: 'a',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    pickupSpot: 'Texas Union' as const,
  };

  it('allows a normal request', () => {
    expect(() => validateRequest([], listings[0], 'me', request, today)).not.toThrow();
  });

  it('blocks borrowing your own item', () => {
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
    const booked = [
      rental({ borrowerId: 'other', status: 'accepted', startDate: '2026-10-21', endDate: '2026-10-22' }),
    ];
    expect(() => validateRequest(booked, listings[0], 'me', request, today)).toThrow('already booked');
  });

  it("doesn't let pending requests from others block dates", () => {
    const pending = [rental({ borrowerId: 'other', status: 'requested' })];
    expect(() => validateRequest(pending, listings[0], 'me', request, today)).not.toThrow();
  });

  it('refuses an offer under the listed price', () => {
    expect(() => validateRequest([], listings[0], 'me', { ...request, offeredPricePerDay: 1 }, today)).toThrow(
      'listed daily price'
    );
  });

  it('counts other open offers on the same dates', () => {
    const pending = [
      rental({ borrowerId: 'other', status: 'requested' }),
      rental({ borrowerId: 'later', status: 'requested', startDate: '2026-11-01', endDate: '2026-11-02' }),
      rental({ borrowerId: 'me', status: 'requested' }),
    ];
    expect(openOfferCount(pending, 'a', '2026-10-20', '2026-10-21', 'me')).toBe(1);
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
    expect(() => confirmReturn(rental({ status: 'accepted', ...CODES }), 'lender', '2222', now)).toThrow("isn't out");
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

describe('daysUntilDue', () => {
  const out = rental({ status: 'picked_up', endDate: '2026-10-21' });

  it('counts whole days until the end of the return date', () => {
    expect(daysUntilDue(out, local('2026-10-18T12:00:00'))).toBe(3);
    expect(daysUntilDue(out, local('2026-10-19T12:00:00'))).toBe(2);
    expect(daysUntilDue(out, local('2026-10-20T12:00:00'))).toBe(1);
  });

  it('is 0 on the due date, during grace, and once overdue', () => {
    expect(daysUntilDue(out, local('2026-10-21T12:00:00'))).toBe(0);
    expect(daysUntilDue(out, local('2026-10-21T23:00:00'))).toBe(0);
    expect(daysUntilDue(out, local('2026-10-22T01:30:00'))).toBe(0);
    expect(daysUntilDue(out, local('2026-10-22T02:30:00'))).toBe(0);
    expect(daysUntilDue(out, local('2026-10-25T12:00:00'))).toBe(0);
  });
});

describe('formatRemainingTime', () => {
  const out = rental({ status: 'picked_up', endDate: '2026-10-21' });

  it('says how many days are left, due today, or overdue', () => {
    expect(formatRemainingTime(out, local('2026-10-18T12:00:00'))).toBe('3 days left');
    expect(formatRemainingTime(out, local('2026-10-20T12:00:00'))).toBe('1 day left');
    expect(formatRemainingTime(out, local('2026-10-21T12:00:00'))).toBe('Due today');
    expect(formatRemainingTime(out, local('2026-10-22T01:30:00'))).toBe('Due today');
    expect(formatRemainingTime(out, local('2026-10-22T02:30:00'))).toBe('1 day overdue');
    expect(formatRemainingTime(out, local('2026-10-25T12:00:00'))).toBe('3 days overdue');
  });
});

describe('orders', () => {
  it('splits one side into active (soonest first) and past (newest first)', () => {
    const later = rental({ status: 'accepted', startDate: '2026-10-25', endDate: '2026-10-26' });
    const out = rental({ status: 'picked_up', startDate: '2026-10-20', endDate: '2026-10-21' });
    const waiting = rental({ status: 'requested', startDate: '2026-10-28', endDate: '2026-10-28' });
    const oldReturn = rental({ status: 'returned', startDate: '2026-09-01', endDate: '2026-09-02' });
    const newReturn = rental({ status: 'returned', startDate: '2026-10-01', endDate: '2026-10-02' });
    const missed = rental({ status: 'no_show', startDate: '2026-09-10', endDate: '2026-09-10' });
    const declined = rental({ status: 'declined' });
    const lentOut = rental({ status: 'picked_up', borrowerId: 'other', lenderId: 'me' });
    const result = ordersFor(
      [later, out, waiting, oldReturn, newReturn, missed, declined, lentOut],
      'me',
      'borrower',
      '2026-10-20'
    );
    expect(result.active).toEqual([out, later, waiting]);
    expect(result.past).toEqual([newReturn, missed, oldReturn]);
    expect(ordersFor([lentOut, out], 'me', 'lender', '2026-10-20')).toEqual({
      active: [lentOut],
      past: [],
      requests: [],
    });
    expect(result.requests).toEqual([]);
  });

  it('gives lenders their incoming requests in a separate list', () => {
    const asked = rental({ status: 'requested', borrowerId: 'other', lenderId: 'me' });
    const lentOut = rental({ status: 'picked_up', borrowerId: 'other', lenderId: 'me' });
    expect(ordersFor([asked, lentOut], 'me', 'lender', '2026-10-20')).toEqual({
      active: [lentOut],
      past: [],
      requests: [asked],
    });
  });

  it('tracks each borrow through requested, confirmed, pickup, and return', () => {
    const now = local('2026-10-20T10:00:00');
    expect(orderStage(rental({ status: 'requested' }), now, 'borrower')).toMatchObject({ step: 1, tone: 'muted' });
    expect(orderStage(rental({ status: 'requested' }), now, 'lender')).toMatchObject({
      status: 'Needs your answer',
      tone: 'accent',
    });
    expect(orderStage(rental({ status: 'accepted', startDate: '2026-10-20' }), now, 'borrower')).toEqual({
      status: 'Awaiting pickup',
      tone: 'accent',
      next: { label: 'Pickup', text: 'Today · Texas Union' },
      step: 2,
    });
    expect(orderStage(rental({ status: 'picked_up', endDate: '2026-10-21' }), now, 'lender')).toMatchObject({
      status: 'In use',
      next: { label: 'Return', text: 'Tomorrow · Texas Union' },
      step: 3,
    });
    expect(orderStage(rental({ status: 'picked_up', endDate: '2026-10-17' }), now, 'borrower')).toMatchObject({
      tone: 'danger',
    });
    expect(orderStage(rental({ status: 'returned' }), now, 'borrower')).toMatchObject({ step: 4, next: null });
    expect(orderStage(rental({ status: 'no_show' }), now, 'borrower').step).toBeNull();
  });

  it('shows each side only the code it hands over', () => {
    const accepted = rental({ status: 'accepted', pickupCode: '1234', returnCode: '5678' });
    const out = rental({ status: 'picked_up', pickupCode: '1234', returnCode: '5678' });
    expect(codeToShow(accepted, 'lender')).toBe('1234');
    expect(codeToShow(accepted, 'borrower')).toBeUndefined();
    expect(codeToShow(out, 'borrower')).toBe('5678');
    expect(codeToShow(out, 'lender')).toBeUndefined();
  });

  it('describes where each borrow stands', () => {
    const now = local('2026-10-20T10:00:00');
    expect(orderStatus(rental({ status: 'requested', startDate: '2026-10-21' }), now)).toMatchObject({
      label: 'Waiting for lender',
      text: 'Pickup tomorrow',
    });
    expect(orderStatus(rental({ status: 'requested' }), now, 'lender').label).toBe('Needs your answer');
    expect(orderStatus(rental({ status: 'accepted', startDate: '2026-10-20' }), now).text).toBe('Today at Texas Union');
    expect(orderStatus(rental({ status: 'picked_up', endDate: '2026-10-21' }), now)).toMatchObject({
      label: 'Return countdown',
      text: 'Return by tomorrow',
      tone: 'accent',
    });
    expect(orderStatus(rental({ status: 'picked_up', endDate: '2026-10-17' }), now)).toMatchObject({
      label: 'Overdue',
      tone: 'danger',
    });
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
  const request = {
    listingId: 'a',
    startDate: '2026-10-20',
    endDate: '2026-10-22',
    pickupSpot: 'Texas Union' as const,
  };

  it('blocks requests for paused listings', () => {
    expect(() => validateRequest([], { ...listings[0], paused: true }, 'me', request, today)).toThrow(
      "isn't available"
    );
  });

  it('blocks requests after the item is sold', () => {
    expect(() => validateRequest([], { ...listings[0], soldAt: '2026-10-16T00:00:00Z' }, 'me', request, today)).toThrow(
      'has been sold'
    );
  });

  it("only allows the lender's pickup spots, when they picked some", () => {
    const picky = { ...listings[0], pickupSpots: ['Jester Center' as const] };
    expect(() => validateRequest([], picky, 'me', request, today)).toThrow("lender's pickup spots");
    expect(() => validateRequest([], picky, 'me', { ...request, pickupSpot: 'Jester Center' }, today)).not.toThrow();
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

describe('booked days', () => {
  it('lists every day of accepted and active borrows for that listing only', () => {
    const rentals = [
      rental({ status: 'accepted', startDate: '2026-10-30', endDate: '2026-11-01' }),
      rental({ status: 'picked_up', startDate: '2026-11-05', endDate: '2026-11-05' }),
      rental({ status: 'requested', startDate: '2026-11-10', endDate: '2026-11-11' }),
      rental({ status: 'accepted', listingId: 'b', startDate: '2026-11-12', endDate: '2026-11-12' }),
    ];
    expect([...bookedDays(rentals, 'a')]).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-05']);
  });
});

describe('picking borrow dates on the calendar', () => {
  const free = () => true;
  const booked22 = (start: string, end: string) => !rangesOverlap(start, end, '2026-10-22', '2026-10-22');

  it('picks a pickup day, then extends to a later return day', () => {
    const first = pickRange(null, '2026-10-20', free);
    expect(first).toEqual({ startDate: '2026-10-20', endDate: '2026-10-20' });
    expect(pickRange(first, '2026-10-23', free)).toEqual({ startDate: '2026-10-20', endDate: '2026-10-23' });
  });

  it('starts over on an earlier day, a third tap, or a range that is too long', () => {
    const range = { startDate: '2026-10-20', endDate: '2026-10-23' };
    expect(pickRange(range, '2026-10-25', free)).toEqual({ startDate: '2026-10-25', endDate: '2026-10-25' });
    const single = { startDate: '2026-10-20', endDate: '2026-10-20' };
    expect(pickRange(single, '2026-10-18', free)).toEqual({ startDate: '2026-10-18', endDate: '2026-10-18' });
    expect(pickRange(single, '2026-11-10', free)).toEqual({ startDate: '2026-11-10', endDate: '2026-11-10' });
  });

  it('ignores unavailable days and never spans one', () => {
    const single = { startDate: '2026-10-20', endDate: '2026-10-20' };
    expect(pickRange(single, '2026-10-22', booked22)).toBe(single);
    expect(pickRange(single, '2026-10-24', booked22)).toEqual({ startDate: '2026-10-24', endDate: '2026-10-24' });
  });
});

describe('available on a day', () => {
  const item = listings[0];
  it('is free unless an accepted or active borrow covers the day, or the owner blocked it', () => {
    const out = rental({ status: 'picked_up', startDate: '2026-10-20', endDate: '2026-10-22' });
    const waiting = rental({ status: 'requested', startDate: '2026-10-25', endDate: '2026-10-25' });
    expect(isAvailableOn([out, waiting], item, '2026-10-21')).toBe(false);
    expect(isAvailableOn([out, waiting], item, '2026-10-25')).toBe(true);
    expect(isAvailableOn([], { ...item, blockedDates: ['2026-10-26'] }, '2026-10-26')).toBe(false);
  });
});

describe('pickup times', () => {
  const now = local('2026-10-20T10:00:00');

  it('shows the time with the date and place', () => {
    const accepted = rental({ status: 'accepted', startDate: '2026-10-21', pickupTime: '16:00' });
    expect(orderStage(accepted, now, 'borrower').next).toEqual({
      label: 'Pickup',
      text: 'Tomorrow, 4:00 PM · Texas Union',
    });
    const out = rental({ status: 'picked_up', endDate: '2026-10-21', returnTime: '09:00' });
    expect(orderStage(out, now, 'lender').next?.text).toBe('Tomorrow, 9:00 AM · Texas Union');
  });

  it('offers meeting times every hour from 9 AM to 9 PM', () => {
    expect(MEETING_TIMES[0]).toBe('09:00');
    expect(MEETING_TIMES.at(-1)).toBe('21:00');
    expect(MEETING_TIMES).toHaveLength(13);
  });
});

describe('validateRequest times', () => {
  it('needs the return after the pickup on a one-day borrow', () => {
    const item = listing('a', 'owner');
    const oneDay = {
      listingId: 'a',
      startDate: '2026-10-25',
      endDate: '2026-10-25',
      pickupSpot: 'Texas Union' as const,
    };
    expect(() =>
      validateRequest([], item, 'me', { ...oneDay, pickupTime: '16:00', returnTime: '12:00' }, '2026-10-20')
    ).toThrow('return time has to be after');
    expect(() =>
      validateRequest([], item, 'me', { ...oneDay, pickupTime: '12:00', returnTime: '16:00' }, '2026-10-20')
    ).not.toThrow();
    expect(() =>
      validateRequest(
        [],
        item,
        'me',
        { ...oneDay, endDate: '2026-10-26', pickupTime: '16:00', returnTime: '12:00' },
        '2026-10-20'
      )
    ).not.toThrow();
  });
});

describe('sell-only listings', () => {
  it("can't be borrowed", () => {
    const item = { ...listing('a', 'owner'), rentable: false, pricePerDay: 0, salePrice: 30 };
    const request = {
      listingId: 'a',
      startDate: '2026-10-25',
      endDate: '2026-10-26',
      pickupSpot: 'Texas Union' as const,
    };
    expect(() => validateRequest([], item, 'me', request, '2026-10-20')).toThrow('only for sale');
  });
});

describe('expired requests', () => {
  const stale = rental({
    status: 'requested',
    startDate: '2026-11-06',
    endDate: '2026-11-07',
    borrowerId: 'other',
    lenderId: 'me',
  });
  const upcoming = rental({
    status: 'requested',
    startDate: '2026-11-14',
    endDate: '2026-11-15',
    borrowerId: 'other',
    lenderId: 'me',
  });

  it('expires a waiting request once its pickup day has passed', () => {
    expect(isExpiredRequest(stale, '2026-11-11')).toBe(true);
    expect(isExpiredRequest(upcoming, '2026-11-11')).toBe(false);
    expect(isExpiredRequest({ ...stale, startDate: '2026-11-11' }, '2026-11-11')).toBe(false);
    expect(isExpiredRequest({ ...stale, status: 'accepted' }, '2026-11-11')).toBe(false);
  });

  it('moves expired requests out of Requests and into Past', () => {
    expect(ordersFor([stale, upcoming], 'me', 'lender', '2026-11-11')).toEqual({
      active: [],
      past: [stale],
      requests: [upcoming],
    });
  });

  it('labels them expired with no tracker', () => {
    expect(orderStage(stale, local('2026-11-11T10:00:00'), 'lender')).toEqual({
      status: 'Expired: pickup day passed',
      tone: 'muted',
      next: null,
      step: null,
    });
  });
});

describe('dragRange', () => {
  const free = () => true;

  it('covers the days dragged across, in either direction', () => {
    expect(dragRange('2026-10-20', '2026-10-23', free)).toEqual({ startDate: '2026-10-20', endDate: '2026-10-23' });
    expect(dragRange('2026-10-20', '2026-10-18', free)).toEqual({ startDate: '2026-10-18', endDate: '2026-10-20' });
  });

  it('stops before a taken day and at the longest borrow', () => {
    const taken = (start: string) => start !== '2026-10-22';
    expect(dragRange('2026-10-20', '2026-10-25', taken)).toEqual({ startDate: '2026-10-20', endDate: '2026-10-21' });
    const long = dragRange('2026-10-01', '2026-10-30', free);
    expect(long?.endDate).toBe('2026-10-14');
  });

  it('ignores a drag that starts on a taken day', () => {
    expect(dragRange('2026-10-22', '2026-10-25', (start) => start !== '2026-10-22')).toBeNull();
  });
});

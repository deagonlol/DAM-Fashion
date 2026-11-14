import {
  createReport,
  isBlockedBetween,
  isRestricted,
  penaltyFor,
  reviewReport,
  strikesFor,
  type Strike,
} from '../moderation';
import type { Rental, Report } from '../types';

const now = new Date('2026-10-16T12:00:00');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
const dateDaysAgo = (n: number) => {
  const d = daysAgo(n);
  const pad = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

let id = 0;
function rental(overrides: Partial<Rental>): Rental {
  id += 1;
  return {
    id: `r${id}`,
    listingId: 'a',
    borrowerId: 'borrower',
    lenderId: 'lender',
    startDate: dateDaysAgo(10),
    endDate: dateDaysAgo(9),
    pickupSpot: 'Texas Union',
    status: 'returned',
    createdAt: daysAgo(12).toISOString(),
    ...overrides,
  };
}

function report(overrides: Partial<Report>): Report {
  id += 1;
  return {
    id: `rp${id}`,
    reporterId: 'reporter',
    reportedUserId: 'borrower',
    reason: 'Harassment or threats',
    details: 'Rude messages',
    createdAt: daysAgo(5).toISOString(),
    status: 'open',
    ...overrides,
  };
}

const strike = (daysBefore: number): Strike => ({
  userId: 'u',
  source: 'no_show',
  refId: 'x',
  at: daysAgo(daysBefore).toISOString(),
});

describe('strikesFor', () => {
  it('gives the no-show strike to the person who did not report it', () => {
    const noShow = rental({ status: 'no_show', noShowReportedBy: 'lender' });
    expect(strikesFor('borrower', [noShow], [], now)).toHaveLength(1);
    expect(strikesFor('lender', [noShow], [], now)).toHaveLength(0);

    const lenderNoShow = rental({ status: 'no_show', noShowReportedBy: 'borrower' });
    expect(strikesFor('lender', [lenderNoShow], [], now)).toHaveLength(1);
  });

  it('strikes returns more than 3 days late, but not slightly late ones', () => {
    const due = dateDaysAgo(9);
    const slightlyLate = rental({ endDate: due, returnedAt: daysAgo(8).toISOString(), returnedLate: true });
    const veryLate = rental({ endDate: due, returnedAt: daysAgo(4).toISOString(), returnedLate: true });
    expect(strikesFor('borrower', [slightlyLate], [], now)).toHaveLength(0);
    expect(strikesFor('borrower', [veryLate], [], now)).toHaveLength(1);
  });

  it('strikes an item still out more than 3 days past due', () => {
    const stillOut = rental({ status: 'picked_up', endDate: dateDaysAgo(5), returnedAt: undefined });
    const justDue = rental({ status: 'picked_up', endDate: dateDaysAgo(1), returnedAt: undefined });
    expect(strikesFor('borrower', [stillOut], [], now)).toHaveLength(1);
    expect(strikesFor('borrower', [justDue], [], now)).toHaveLength(0);
  });

  it('keeps the late strike when an item is reported lost after the cutoff, but not before', () => {
    const due = dateDaysAgo(9);
    const lostEarly = rental({ status: 'lost', endDate: due, returnedAt: undefined, lostAt: daysAgo(9).toISOString() });
    const lostLate = rental({ status: 'lost', endDate: due, returnedAt: undefined, lostAt: daysAgo(1).toISOString() });
    expect(strikesFor('borrower', [lostEarly], [], now)).toHaveLength(0);
    expect(strikesFor('borrower', [lostLate], [], now).map((s) => s.source)).toEqual(['late_return']);
  });

  it('only counts reports the team upheld', () => {
    const reports = [
      report({ status: 'open' }),
      report({ status: 'dismissed' }),
      report({ status: 'upheld', reviewedAt: daysAgo(1).toISOString() }),
    ];
    expect(strikesFor('borrower', [], reports, now).map((s) => s.source)).toEqual(['report']);
  });

  it("doesn't double-count an upheld report about a borrow that's already a strike", () => {
    const noShow = rental({ status: 'no_show', noShowReportedBy: 'lender' });
    const sameIncident = report({ status: 'upheld', reason: 'No-show', rentalId: noShow.id, reviewedAt: daysAgo(1).toISOString() });
    const separate = report({ status: 'upheld', reviewedAt: daysAgo(1).toISOString() });
    expect(strikesFor('borrower', [noShow], [sameIncident], now)).toHaveLength(1);
    expect(strikesFor('borrower', [noShow], [sameIncident, separate], now)).toHaveLength(2);
  });

  it('forgets strikes older than 180 days', () => {
    const old = rental({ status: 'no_show', noShowReportedBy: 'lender', startDate: dateDaysAgo(200), endDate: dateDaysAgo(199) });
    expect(strikesFor('borrower', [old], [], now)).toHaveLength(0);
  });
});

describe('penaltyFor', () => {
  it('escalates: none → warning → soft ban → ban', () => {
    expect(penaltyFor([], now)).toEqual({ level: 'none' });
    expect(penaltyFor([strike(10)], now)).toEqual({ level: 'warning', strikes: 1 });
    expect(penaltyFor([strike(30), strike(2)], now).level).toBe('soft_ban');
    expect(penaltyFor([strike(30), strike(20), strike(2)], now)).toEqual({ level: 'banned', strikes: 3 });
  });

  it('lifts a soft ban 7 days after the latest strike, back to a warning', () => {
    const soft = penaltyFor([strike(30), strike(2)], now);
    expect(soft).toMatchObject({ level: 'soft_ban' });
    if (soft.level === 'soft_ban') {
      expect(new Date(soft.until).getTime()).toBe(daysAgo(2).getTime() + 7 * 24 * 60 * 60 * 1000);
    }
    expect(penaltyFor([strike(30), strike(8)], now)).toEqual({ level: 'warning', strikes: 2 });
  });

  it('restricts soft bans and bans only', () => {
    expect(isRestricted({ level: 'warning', strikes: 1 })).toBe(false);
    expect(isRestricted({ level: 'soft_ban', strikes: 2, until: now.toISOString() })).toBe(true);
    expect(isRestricted({ level: 'banned', strikes: 3 })).toBe(true);
  });
});

describe('reports', () => {
  const input = { reportedUserId: 'borrower', reason: 'No-show' as const, details: ' Never came ' };

  it('creates an open report with trimmed details', () => {
    expect(createReport('reporter', input, [], now)).toMatchObject({ status: 'open', details: 'Never came' });
  });

  it("blocks self-reports, empty details, and duplicate open reports", () => {
    expect(() => createReport('borrower', input, [], now)).toThrow('yourself');
    expect(() => createReport('reporter', { ...input, details: '  ' }, [], now)).toThrow('what happened');
    const existing = [createReport('reporter', input, [], now)];
    expect(() => createReport('reporter', input, existing, now)).toThrow('already have an open report');
    expect(() => createReport('reporter', { ...input, reason: 'Harassment or threats' }, existing, now)).not.toThrow();
  });

  it('can be reviewed once', () => {
    const upheld = reviewReport(report({}), 'upheld', now);
    expect(upheld).toMatchObject({ status: 'upheld', reviewedAt: now.toISOString() });
    expect(() => reviewReport(upheld, 'dismissed', now)).toThrow('already reviewed');
  });
});

describe('isBlockedBetween', () => {
  it('applies both ways', () => {
    const blocks = [{ blockerId: 'a', blockedId: 'b', createdAt: now.toISOString() }];
    expect(isBlockedBetween(blocks, 'a', 'b')).toBe(true);
    expect(isBlockedBetween(blocks, 'b', 'a')).toBe(true);
    expect(isBlockedBetween(blocks, 'a', 'c')).toBe(false);
  });
});

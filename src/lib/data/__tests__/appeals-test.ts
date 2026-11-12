import { appealOption, latestAppealFor } from '../appeals';
import { overturnedKey, strikesFor, type Strike } from '../moderation';
import type { Appeal, Rental } from '../types';

const appeal = (overrides: Partial<Appeal>): Appeal => ({
  id: Math.random().toString(),
  userId: 'me',
  source: 'no_show',
  refId: 'r1',
  reason: 'They changed the spot in chat.',
  level: 1,
  status: 'pending',
  createdAt: '2026-11-10T00:00:00Z',
  ...overrides,
});

const strike: Strike = { userId: 'me', source: 'no_show', refId: 'r1', at: '2026-11-08T18:00:00Z' };

describe('appealOption', () => {
  it('offers an appeal first, then a human review only after a denied first appeal', () => {
    expect(appealOption(undefined)).toBe('appeal');
    expect(appealOption(appeal({ status: 'pending' }))).toBeNull();
    expect(appealOption(appeal({ status: 'denied' }))).toBe('human_review');
    expect(appealOption(appeal({ status: 'approved' }))).toBeNull();
    expect(appealOption(appeal({ status: 'denied', level: 2 }))).toBeNull();
  });
});

describe('latestAppealFor', () => {
  it('picks the highest-level appeal for that exact strike', () => {
    const first = appeal({ status: 'denied' });
    const second = appeal({ level: 2 });
    const other = appeal({ refId: 'r2', level: 2 });
    expect(latestAppealFor([first, other, second], strike)).toBe(second);
    expect(latestAppealFor([other], strike)).toBeUndefined();
  });
});

describe('strikes overturned on appeal', () => {
  const noShow: Rental = {
    id: 'r1',
    listingId: 'l1',
    borrowerId: 'me',
    lenderId: 'lender',
    startDate: '2026-11-08',
    endDate: '2026-11-09',
    pickupSpot: 'Texas Union',
    status: 'no_show',
    noShowReportedBy: 'lender',
    createdAt: '2026-11-01T00:00:00Z',
  };
  const now = new Date('2026-11-11T12:00:00Z');

  it('no longer count', () => {
    expect(strikesFor('me', [noShow], [], now)).toHaveLength(1);
    expect(strikesFor('me', [noShow], [], now, new Set([overturnedKey('me', 'no_show', 'r1')]))).toHaveLength(0);
  });
});

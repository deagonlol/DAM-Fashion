import { notificationPlans } from '../notification-plans';
import { noticesFor } from '../notices';
import type { Reminder } from '../reminders';
import type { Listing, Rental } from '../types';

const now = new Date('2026-11-12T10:00:00');
const listing: Listing = {
  id: 'l1',
  ownerId: 'lender',
  title: 'Black satin dress',
  description: '',
  category: 'Dresses',
  events: ['Formal'],
  size: 'S',
  pricePerDay: 10,
  imageUris: [],
  createdAt: '2026-11-01T00:00:00Z',
};
const rental = (overrides: Partial<Rental> & Pick<Rental, 'id'>): Rental => ({
  listingId: 'l1',
  borrowerId: 'me',
  lenderId: 'lender',
  startDate: '2026-11-13',
  endDate: '2026-11-14',
  pickupSpot: 'Gregory Gym',
  status: 'accepted',
  createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
});
const run = (rentals: Rental[], userId = 'me') => notificationPlans({ userId, rentals, listings: [listing], now });

describe('notificationPlans', () => {
  it('schedules the evening before a pickup and an hour before it', () => {
    const plans = run([rental({ id: 'r1', pickupTime: '16:00' })]);
    expect(plans.map((plan) => plan.id)).toEqual(['pickup-eve-r1', 'pickup-hour-r1']);
    expect(plans[0]).toMatchObject({ title: 'Pickup tomorrow', body: 'Black satin dress · Gregory Gym · 4:00 PM' });
    expect(plans[0].fireAt.getDate()).toBe(12);
    expect(plans[0].fireAt.getHours()).toBe(18);
    expect(plans[1].title).toBe('Pickup in 1 hour');
    expect(plans[1].fireAt.getDate()).toBe(13);
    expect(plans[1].fireAt.getHours()).toBe(15);
  });

  it('skips the day-before alert once that evening has passed', () => {
    const plans = run([rental({ id: 'r1', startDate: '2026-11-12', endDate: '2026-11-12', pickupTime: '16:00' })]);
    expect(plans.map((plan) => plan.id)).toEqual(['pickup-hour-r1']);
  });

  it('reminds the lender an hour before the item comes back', () => {
    const plans = run(
      [rental({ id: 'r1', status: 'picked_up', startDate: '2026-11-11', endDate: '2026-11-13', returnTime: '17:00' })],
      'lender'
    );
    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({ id: 'return-r1', title: 'Black satin dress comes back today' });
    expect(plans[0].fireAt.getDate()).toBe(13);
    expect(plans[0].fireAt.getHours()).toBe(16);
  });

  it('uses 9:00 AM on the return day when no return time was set', () => {
    const [plan] = run([
      rental({ id: 'r1', status: 'picked_up', startDate: '2026-11-11', endDate: '2026-11-13' }),
    ]);
    expect(plan.fireAt.getHours()).toBe(9);
    expect(plan.fireAt.getDate()).toBe(13);
  });

  it('does not schedule a return that is already overdue', () => {
    expect(
      run([rental({ id: 'r1', status: 'picked_up', startDate: '2026-11-01', endDate: '2026-11-05' })])
    ).toEqual([]);
  });

  it('ignores a borrow that is not yours', () => {
    expect(run([rental({ id: 'r1', borrowerId: 'other', lenderId: 'someone' })])).toEqual([]);
  });
});

describe('noticesFor', () => {
  it('puts unread messages ahead of reminders', () => {
    const reminder: Reminder = {
      key: 'pickup-r1',
      title: 'Pickup today',
      tone: 'accent',
      href: '/rental/r1',
    };
    const [first, second] = noticesFor([reminder], [
      { id: 'c1', name: 'Maya', unread: 2, preview: 'Running late' },
      { id: 'c2', name: 'Ethan', unread: 0 },
    ]);
    expect(first).toMatchObject({ title: '2 new messages from Maya', detail: 'Running late', href: '/chat/c1' });
    expect(second.key).toBe('pickup-r1');
  });
});

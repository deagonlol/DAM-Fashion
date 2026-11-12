import { remindersFor } from '../reminders';
import type { Listing, Rental, RentalProposal, Sale } from '../types';

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
  startDate: '2026-11-12',
  endDate: '2026-11-13',
  pickupSpot: 'Gregory Gym',
  status: 'accepted',
  createdAt: '2026-11-01T00:00:00Z',
  ...overrides,
});
const run = (rentals: Rental[], extra: { sales?: Sale[]; proposals?: RentalProposal[]; userId?: string } = {}) =>
  remindersFor({
    userId: extra.userId ?? 'me',
    rentals,
    sales: extra.sales ?? [],
    proposals: extra.proposals ?? [],
    listings: [listing],
    now,
  });

describe('remindersFor', () => {
  it('shows a pickup today with its time and place', () => {
    const [reminder] = run([rental({ id: 'r1', pickupTime: '16:00' })]);
    expect(reminder).toMatchObject({
      title: 'Pickup today, 4:00 PM',
      detail: 'Black satin dress · Gregory Gym',
      href: '/rental/r1',
    });
  });

  it('puts overdue returns first, then the soonest handoffs', () => {
    const overdue = rental({ id: 'late', status: 'picked_up', startDate: '2026-11-01', endDate: '2026-11-05' });
    const tomorrow = rental({ id: 'tom', startDate: '2026-11-13', endDate: '2026-11-14' });
    const today = rental({ id: 'tod', pickupTime: '18:00' });
    expect(run([tomorrow, today, overdue]).map((r) => r.key)).toEqual(['overdue-late', 'pickup-tod', 'pickup-tom']);
  });

  it('skips handoffs further out than tomorrow', () => {
    expect(run([rental({ id: 'r1', startDate: '2026-11-20', endDate: '2026-11-21' })])).toEqual([]);
  });

  it('counts requests waiting on the lender, leaving out expired ones', () => {
    const asked = rental({ id: 'a', status: 'requested', startDate: '2026-11-15', endDate: '2026-11-16' });
    const stale = rental({ id: 's', status: 'requested', startDate: '2026-11-01', endDate: '2026-11-02' });
    const buy: Sale = {
      id: 'b',
      listingId: 'l1',
      buyerId: 'x',
      sellerId: 'lender',
      price: 40,
      status: 'requested',
      createdAt: '2026-11-10T00:00:00Z',
    };
    const [reminder] = run([asked, stale], { sales: [buy], userId: 'lender' });
    expect(reminder).toMatchObject({ title: '2 requests waiting for you', detail: '1 to borrow · 1 to buy' });
  });

  it('flags a counter-offer waiting on you, but not your own', () => {
    const asked = rental({ id: 'a', status: 'requested', startDate: '2026-11-15', endDate: '2026-11-16' });
    const proposal: RentalProposal = {
      id: 'p',
      rentalId: 'a',
      proposerId: 'lender',
      startDate: '2026-11-15',
      endDate: '2026-11-16',
      pickupSpot: 'Gregory Gym',
      pricePerDay: 8,
      note: '',
      status: 'pending',
      createdAt: '2026-11-11T00:00:00Z',
    };
    expect(run([asked], { proposals: [proposal] })[0].title).toBe('Counter-offer to review');
    expect(run([asked], { proposals: [proposal], userId: 'lender' }).map((r) => r.key)).toEqual(['requests']);
  });
});

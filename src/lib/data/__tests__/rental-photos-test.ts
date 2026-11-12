import { canAddConditionPhotos, photosLeft } from '../rental-photos';
import type { Rental, RentalPhoto } from '../types';

const rental = (status: Rental['status']): Rental => ({
  id: 'r1',
  listingId: 'l1',
  borrowerId: 'borrower',
  lenderId: 'lender',
  startDate: '2026-11-14',
  endDate: '2026-11-15',
  pickupSpot: 'Texas Union',
  status,
  createdAt: '2026-11-10T00:00:00Z',
});

const photo = (overrides: Partial<RentalPhoto>): RentalPhoto => ({
  id: Math.random().toString(),
  rentalId: 'r1',
  uploaderId: 'borrower',
  stage: 'pickup',
  path: 'r1/borrower/a.jpg',
  createdAt: '2026-11-14T16:00:00Z',
  ...overrides,
});

describe('canAddConditionPhotos', () => {
  it('allows pickup photos around pickup and return photos around the return', () => {
    expect(canAddConditionPhotos(rental('requested'), 'pickup')).toBe(false);
    expect(canAddConditionPhotos(rental('accepted'), 'pickup')).toBe(true);
    expect(canAddConditionPhotos(rental('picked_up'), 'pickup')).toBe(true);
    expect(canAddConditionPhotos(rental('accepted'), 'return')).toBe(false);
    expect(canAddConditionPhotos(rental('picked_up'), 'return')).toBe(true);
    expect(canAddConditionPhotos(rental('returned'), 'return')).toBe(true);
    expect(canAddConditionPhotos(rental('cancelled'), 'pickup')).toBe(false);
  });
});

describe('photosLeft', () => {
  it('counts only your own photos for that borrow and handoff, up to 4', () => {
    const photos = [
      photo({}),
      photo({}),
      photo({ uploaderId: 'lender' }),
      photo({ stage: 'return' }),
      photo({ rentalId: 'r2' }),
    ];
    expect(photosLeft(photos, 'r1', 'borrower', 'pickup')).toBe(2);
    expect(photosLeft(photos, 'r1', 'lender', 'pickup')).toBe(3);
    expect(photosLeft([...photos, photo({}), photo({}), photo({})], 'r1', 'borrower', 'pickup')).toBe(0);
  });
});

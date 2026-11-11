import { assertCanAcceptSale, saleOrdersFor, validateSaleRequest } from '../sales';
import type { Listing, Rental, Sale } from '../types';

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'cape',
    ownerId: 'alex',
    title: 'Cape',
    description: '',
    category: 'Costumes',
    events: ['Halloween'],
    size: 'L',
    pricePerDay: 6,
    salePrice: 40,
    imageUris: [],
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 's1',
    listingId: 'cape',
    buyerId: 'priya',
    sellerId: 'alex',
    price: 40,
    status: 'requested',
    createdAt: '2026-10-16T00:00:00Z',
    ...overrides,
  };
}

function rental(status: Rental['status']): Rental {
  return {
    id: 'r1',
    listingId: 'cape',
    borrowerId: 'ronit',
    lenderId: 'alex',
    startDate: '2026-10-20',
    endDate: '2026-10-21',
    pickupSpot: 'Texas Union',
    status,
    createdAt: '2026-10-16T00:00:00Z',
  };
}

describe('buy requests', () => {
  it('allows a buy when the sale price is set and the item is still available', () => {
    expect(() => validateSaleRequest([], listing(), 'priya')).not.toThrow();
  });

  it('refuses a second open request, a rent-only listing, and a sold item', () => {
    expect(() => validateSaleRequest([sale()], listing(), 'priya')).toThrow('already asked');
    expect(() => validateSaleRequest([], listing({ salePrice: undefined }), 'priya')).toThrow("isn't for sale");
    expect(() => validateSaleRequest([], listing({ soldAt: '2026-10-16T00:00:00Z' }), 'priya')).toThrow('has been sold');
  });

  it('refuses to accept a buy while a borrow is out', () => {
    expect(() => assertCanAcceptSale([rental('picked_up')], sale(), 'alex')).toThrow('Finish the current borrow');
    expect(() => assertCanAcceptSale([rental('returned')], sale(), 'alex')).not.toThrow();
    expect(() => assertCanAcceptSale([], sale(), 'priya')).toThrow('Only the seller');
  });
});

describe('saleOrdersFor', () => {
  const open = sale({ id: 'open', status: 'requested', createdAt: '2026-11-02T00:00:00Z' });
  const sold = sale({ id: 'sold', status: 'accepted', createdAt: '2026-11-01T00:00:00Z' });
  const declined = sale({ id: 'no', status: 'declined' });

  it('shows buyers their open requests as active and bought items as past', () => {
    expect(saleOrdersFor([sold, open, declined], 'priya', 'buyer')).toEqual({
      active: [open],
      past: [sold],
      requests: [],
    });
  });

  it('gives sellers open requests to answer', () => {
    expect(saleOrdersFor([sold, open, declined], 'alex', 'seller')).toEqual({
      active: [],
      past: [sold],
      requests: [open],
    });
  });
});

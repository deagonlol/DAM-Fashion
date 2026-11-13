import { lateFee, rentalPrice, salePrice } from '../fees';

describe('rentalPrice', () => {
  it('adds 15% on top and the lender keeps the full price', () => {
    expect(rentalPrice(6, 2)).toEqual({ subtotal: 12, fee: 1.8, total: 13.8 });
    expect(rentalPrice(10, 3)).toEqual({ subtotal: 30, fee: 4.5, total: 34.5 });
  });

  it('charges at least $0.50 on a small rental', () => {
    expect(rentalPrice(1, 1)).toEqual({ subtotal: 1, fee: 0.5, total: 1.5 });
  });

  it('rounds to cents', () => {
    expect(rentalPrice(4.33, 1)).toEqual({ subtotal: 4.33, fee: 0.65, total: 4.98 });
  });

  it('charges nothing for a free item', () => {
    expect(rentalPrice(0, 3)).toEqual({ subtotal: 0, fee: 0, total: 0 });
  });
});

describe('salePrice', () => {
  it('adds 5% + $0.70 on top', () => {
    expect(salePrice(20)).toEqual({ subtotal: 20, fee: 1.7, total: 21.7 });
  });
});

describe('lateFee', () => {
  it('is 1.5x the daily price per late day', () => {
    expect(lateFee(6, 2)).toBe(18);
  });

  it('is capped at the item value', () => {
    expect(lateFee(10, 10, 40)).toBe(40);
  });

  it('is zero when not late', () => {
    expect(lateFee(6, 0)).toBe(0);
  });
});

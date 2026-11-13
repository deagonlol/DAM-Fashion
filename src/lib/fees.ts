/**
 * Lendr's pricing model. The person renting or buying pays a service fee on top, so lenders and
 * sellers keep 100% of their price. A rental is 15% of the rental, and at least $0.50, so a $1
 * borrow still clears card processing. A sale is 5% + $0.70. Late charges go entirely to the lender.
 *
 * Fees aren't collected yet: people pay each other at pickup during the beta. Flip FEES_CHARGED
 * once in-app payment exists.
 */
export const FEES_CHARGED = false;

/** `minimum` is a floor on the fee, not an amount added on top of the percent. */
export const RENTAL_FEE = { rate: 0.15, flat: 0, minimum: 0.5 } as const;
export const SALE_FEE = { rate: 0.05, flat: 0.7 } as const;
/** Late returns cost this many times the daily price per late day, capped at the item's value. */
export const LATE_FEE_MULTIPLIER = 1.5;

const cents = (amount: number) => Math.round(amount * 100) / 100;

export type PriceBreakdown = {
  /** What the lender or seller gets. */
  subtotal: number;
  /** Lendr's service fee, paid by the borrower or buyer. */
  fee: number;
  /** What the borrower or buyer pays. */
  total: number;
};

function breakdown(
  subtotal: number,
  { rate, flat, minimum = 0 }: { rate: number; flat: number; minimum?: number },
): PriceBreakdown {
  const base = cents(subtotal);
  if (base <= 0) return { subtotal: 0, fee: 0, total: 0 };
  const fee = Math.max(cents(base * rate + flat), minimum);
  return { subtotal: base, fee, total: cents(base + fee) };
}

export function rentalPrice(pricePerDay: number, days: number) {
  return breakdown(pricePerDay * days, RENTAL_FEE);
}

export function salePrice(price: number) {
  return breakdown(price, SALE_FEE);
}

/** What a late return costs so far, which all goes to the lender. */
export function lateFee(pricePerDay: number, daysLate: number, itemValue?: number) {
  const fee = cents(pricePerDay * LATE_FEE_MULTIPLIER * Math.max(0, daysLate));
  return itemValue != null ? Math.min(fee, itemValue) : fee;
}

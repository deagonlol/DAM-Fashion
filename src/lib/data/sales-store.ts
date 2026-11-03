/** The loaded buy requests, shared by sales.ts and listings.ts without an import cycle. */
import { createStore } from './store';
import type { Sale } from './types';

export const salesStore = createStore<Sale[]>([]);

/** Called when a listing is deleted, so waiting buy requests leave the activity list. */
export function declineSalesForListing(listingId: string) {
  salesStore.set(
    salesStore.get().map((sale) =>
      sale.listingId === listingId && sale.status === 'requested' ? { ...sale, status: 'declined' } : sale
    )
  );
}

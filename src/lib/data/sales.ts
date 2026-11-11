/**
 * Buy requests. A listing can be rented and, when it has a sale price, bought.
 * Accepting a buy marks the listing sold and closes other open requests.
 */
import { supabase } from '../supabase';
import { formatPrice } from '../format';
import { getListingSnapshot, reloadListing } from './listings';
import { getOrCreateConversation, sendMessage } from './messages';
import { assertCanTransact, assertNotBlocked } from './moderation';
import { rentalsStore } from './rentals-store';
import { toSale, unwrap, type SaleRow } from './rows';
import { salesStore } from './sales-store';
import { getCurrentUserId } from './session';
import { upsertById } from './store';
import type { Listing, Rental, Sale } from './types';

export class SaleError extends Error {}

export const subscribeToSales = salesStore.subscribe;
export const getSalesSnapshot = salesStore.get;

export function setSales(sales: Sale[]) {
  salesStore.set(sales);
}

export function putSale(sale: Sale) {
  salesStore.set(upsertById(salesStore.get(), sale));
  return sale;
}

/**
 * The user's buy requests on one side, for the Orders tab, newest first. Buyers see open
 * requests as active; sellers get them as requests to answer. Accepted sales are past.
 * Declined and cancelled ones never happened, so they're left out.
 */
export function saleOrdersFor(sales: Sale[], userId: string, role: 'buyer' | 'seller') {
  const mine = sales
    .filter((sale) => (role === 'buyer' ? sale.buyerId : sale.sellerId) === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const open = mine.filter((sale) => sale.status === 'requested');
  return {
    active: role === 'buyer' ? open : [],
    past: mine.filter((sale) => sale.status === 'accepted'),
    requests: role === 'seller' ? open : [],
  };
}

/** Throws a SaleError explaining why a buy request isn't allowed. */
export function validateSaleRequest(sales: Sale[], listing: Listing, buyerId: string) {
  if (listing.ownerId === buyerId) {
    throw new SaleError("You can't buy your own item.");
  }
  if (listing.soldAt) {
    throw new SaleError('This item has been sold.');
  }
  if (listing.paused) {
    throw new SaleError("This item isn't available right now.");
  }
  if (listing.salePrice == null) {
    throw new SaleError("This item isn't for sale.");
  }
  if (sales.some((sale) => sale.listingId === listing.id && sale.buyerId === buyerId && sale.status === 'requested')) {
    throw new SaleError('You already asked to buy this item.');
  }
}

/** Throws unless this seller can accept the buy. An item out on borrow has to come back first. */
export function assertCanAcceptSale(rentals: Rental[], sale: Sale, actorId: string) {
  if (actorId !== sale.sellerId) throw new SaleError('Only the seller can accept.');
  if (sale.status !== 'requested') throw new SaleError('This request is no longer waiting for a response.');
  const out = rentals.some(
    (rental) => rental.listingId === sale.listingId && (rental.status === 'accepted' || rental.status === 'picked_up')
  );
  if (out) throw new SaleError('Finish the current borrow first.');
}

function findOrThrow(id: string) {
  const sale = salesStore.get().find((item) => item.id === id);
  if (!sale) throw new SaleError('Buy request not found.');
  return sale;
}

async function callSaleFunction(name: string, args: Record<string, unknown>) {
  const row = unwrap(await supabase.rpc(name, args).single<SaleRow>(), SaleError);
  return putSale(toSale(row));
}

/** Sends a buy request at the listed sale price and posts it in the chat. */
export async function requestSale(listingId: string): Promise<Sale> {
  const listing = getListingSnapshot(listingId);
  if (!listing) throw new SaleError('Listing not found.');
  const buyerId = getCurrentUserId();
  assertCanTransact(buyerId, new Date());
  assertNotBlocked(buyerId, listing.ownerId);
  validateSaleRequest(salesStore.get(), listing, buyerId);

  const sale = await callSaleFunction('request_sale', { target_listing_id: listing.id });
  const conversation = await getOrCreateConversation(listing.id);
  await sendMessage(conversation.id, `Requested to buy this for ${formatPrice(sale.price)}.`);
  return sale;
}

export async function acceptSale(id: string) {
  const sale = findOrThrow(id);
  assertCanTransact(getCurrentUserId(), new Date());
  assertCanAcceptSale(rentalsStore.get(), sale, getCurrentUserId());
  const accepted = await callSaleFunction('accept_sale', { target_id: id });
  salesStore.set(
    salesStore.get().map((item) => {
      if (item.id === accepted.id) return accepted;
      if (item.listingId === accepted.listingId && item.status === 'requested') return { ...item, status: 'declined' };
      return item;
    })
  );
  rentalsStore.set(
    rentalsStore
      .get()
      .map((rental) =>
        rental.listingId === accepted.listingId && rental.status === 'requested' ? { ...rental, status: 'declined' } : rental
      )
  );
  await reloadListing(accepted.listingId);
  return accepted;
}

export async function declineSale(id: string) {
  const sale = findOrThrow(id);
  if (getCurrentUserId() !== sale.sellerId) throw new SaleError('Only the seller can decline.');
  if (sale.status !== 'requested') throw new SaleError('This request is no longer waiting for a response.');
  return callSaleFunction('decline_sale', { target_id: id });
}

export async function cancelSale(id: string) {
  const sale = findOrThrow(id);
  if (getCurrentUserId() !== sale.buyerId) throw new SaleError('Only the buyer can cancel.');
  if (sale.status !== 'requested') throw new SaleError('This request is no longer waiting for a response.');
  return callSaleFunction('cancel_sale', { target_id: id });
}

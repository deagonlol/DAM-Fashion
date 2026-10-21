/**
 * Borrowing: requests, handoffs, returns. The rules live in pure functions (exported for tests)
 * and run first for instant feedback; the async functions at the bottom then call the database
 * function of the same name (supabase/migrations/*_app_functions.sql), which re-checks them.
 */
import { supabase } from '../supabase';
import { getCurrentUserId } from './session';
import { getListingSnapshot } from './listings';
import { getOrCreateConversation, sendMessage } from './messages';
import { assertCanTransact, assertNotBlocked } from './moderation';
import { rentalsStore } from './rentals-store';
import { toRental, unwrap, type RentalCodeRow, type RentalRow } from './rows';
import { upsertById } from './store';
import type { Listing, PickupSpot, Rental, RentalStatus } from './types';

export class RentalError extends Error {}

export const MAX_RENTAL_DAYS = 14;
/** Hours after the end of the return date before a borrow counts as late. */
export const LATE_GRACE_HOURS = 2;
/** Hours after a return during which the lender can report a problem with the item. */
export const ISSUE_REPORT_WINDOW_HOURS = 24;

/** Borrows that hold the item: they block overlapping dates for other borrowers. */
const BOOKED: RentalStatus[] = ['accepted', 'picked_up'];
/** Borrows still in progress for the borrower. */
const OPEN: RentalStatus[] = ['requested', 'accepted', 'picked_up'];

// ---- Dates ---------------------------------------------------------------------------------

/** A Date as a local YYYY-MM-DD calendar date. */
export function toDateString(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Number of days in an inclusive date range, e.g. Oct 3 to Oct 4 is 2 days. */
export function rentalDays(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
}

/** Whether two inclusive YYYY-MM-DD ranges share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** When the item is due back: the end of the return date, local time. */
export function dueAt(rental: Rental) {
  return new Date(`${rental.endDate}T23:59:59`);
}

export function isOverdue(rental: Rental, now: Date) {
  return (
    rental.status === 'picked_up' &&
    now.getTime() > dueAt(rental).getTime() + LATE_GRACE_HOURS * 60 * 60 * 1000
  );
}

/** Whole days past the due date, or 0 if not overdue. */
export function daysOverdue(rental: Rental, now: Date) {
  if (!isOverdue(rental, now)) return 0;
  return Math.max(1, Math.floor((now.getTime() - dueAt(rental).getTime()) / (24 * 60 * 60 * 1000)));
}

/** No-shows can be reported once the pickup day has started and the handoff hasn't happened. */
export function canReportNoShow(rental: Rental, now: Date) {
  return rental.status === 'accepted' && now >= new Date(`${rental.startDate}T00:00:00`);
}

export function canReportIssue(rental: Rental, now: Date) {
  if (rental.status !== 'returned' || !rental.returnedAt || rental.conditionIssue) return false;
  const windowEnd = new Date(rental.returnedAt).getTime() + ISSUE_REPORT_WINDOW_HOURS * 60 * 60 * 1000;
  return now.getTime() <= windowEnd;
}

// ---- Rules ---------------------------------------------------------------------------------

export type BorrowRequest = {
  listingId: string;
  startDate: string;
  endDate: string;
  pickupSpot: PickupSpot;
};

/** Throws a RentalError explaining why a borrow request isn't allowed. */
export function validateRequest(
  rentals: Rental[],
  listing: Listing,
  borrowerId: string,
  request: BorrowRequest,
  today: string
) {
  if (listing.ownerId === borrowerId) {
    throw new RentalError("You can't borrow your own item.");
  }
  if (listing.paused) {
    throw new RentalError("This item isn't available to borrow right now.");
  }
  if (request.startDate < today) {
    throw new RentalError('Pick a pickup date from today on.');
  }
  if (request.endDate < request.startDate) {
    throw new RentalError('The return date must be on or after the pickup date.');
  }
  if (rentalDays(request.startDate, request.endDate) > MAX_RENTAL_DAYS) {
    throw new RentalError(`Borrows can be at most ${MAX_RENTAL_DAYS} days.`);
  }
  const forListing = rentals.filter((rental) => rental.listingId === listing.id);
  if (forListing.some((rental) => rental.borrowerId === borrowerId && OPEN.includes(rental.status))) {
    throw new RentalError('You already have an open borrow for this item.');
  }
  const clash = forListing.some(
    (rental) =>
      BOOKED.includes(rental.status) &&
      rangesOverlap(rental.startDate, rental.endDate, request.startDate, request.endDate)
  );
  if (clash) {
    throw new RentalError("It's already booked for some of those dates.");
  }
  const ownerBlocked = (listing.blockedDates ?? []).some(
    (date) => date >= request.startDate && date <= request.endDate
  );
  if (ownerBlocked) {
    throw new RentalError("The owner isn't lending it on some of those dates.");
  }
}

function requireStatus(rental: Rental, allowed: RentalStatus[], message: string) {
  if (!allowed.includes(rental.status)) throw new RentalError(message);
}

function requireActor(actorId: string, expectedId: string, message: string) {
  if (actorId !== expectedId) throw new RentalError(message);
}

/** Lender accepts. Fails if another accepted borrow already covers those dates. */
export function accept(
  rentals: Rental[],
  rental: Rental,
  actorId: string,
  codes: { pickupCode: string; returnCode: string }
): Rental {
  requireActor(actorId, rental.lenderId, 'Only the lender can accept.');
  requireStatus(rental, ['requested'], 'This request is no longer waiting for a response.');
  const clash = rentals.some(
    (other) =>
      other.id !== rental.id &&
      other.listingId === rental.listingId &&
      BOOKED.includes(other.status) &&
      rangesOverlap(other.startDate, other.endDate, rental.startDate, rental.endDate)
  );
  if (clash) {
    throw new RentalError("You've already accepted another borrow for some of these dates.");
  }
  return { ...rental, status: 'accepted', ...codes };
}

export function decline(rental: Rental, actorId: string): Rental {
  requireActor(actorId, rental.lenderId, 'Only the lender can decline.');
  requireStatus(rental, ['requested'], 'This request is no longer waiting for a response.');
  return { ...rental, status: 'declined' };
}

/** Borrower cancels before pickup. */
export function cancel(rental: Rental, actorId: string): Rental {
  requireActor(actorId, rental.borrowerId, 'Only the borrower can cancel.');
  requireStatus(rental, ['requested', 'accepted'], "This borrow can't be cancelled anymore.");
  return { ...rental, status: 'cancelled' };
}

/** Borrower enters the code shown on the lender's screen at the handoff. */
export function confirmPickup(rental: Rental, actorId: string, code: string, now: Date): Rental {
  requireActor(actorId, rental.borrowerId, 'The borrower enters the pickup code.');
  requireStatus(rental, ['accepted'], "This borrow isn't waiting for pickup.");
  if (code.trim() !== rental.pickupCode) {
    throw new RentalError("That code doesn't match. Check the code on the lender's screen.");
  }
  return { ...rental, status: 'picked_up', pickedUpAt: now.toISOString() };
}

/** Lender enters the code shown on the borrower's screen when the item comes back. */
export function confirmReturn(rental: Rental, actorId: string, code: string, now: Date): Rental {
  requireActor(actorId, rental.lenderId, 'The lender enters the return code.');
  requireStatus(rental, ['picked_up'], "This item isn't out on a borrow.");
  if (code.trim() !== rental.returnCode) {
    throw new RentalError("That code doesn't match. Check the code on the borrower's screen.");
  }
  const late = now.getTime() > dueAt(rental).getTime() + LATE_GRACE_HOURS * 60 * 60 * 1000;
  return { ...rental, status: 'returned', returnedAt: now.toISOString(), returnedLate: late };
}

export function reportIssue(rental: Rental, actorId: string, description: string, now: Date): Rental {
  requireActor(actorId, rental.lenderId, 'Only the lender can report a problem with the item.');
  if (!description.trim()) throw new RentalError('Describe what was wrong.');
  if (!canReportIssue(rental, now)) {
    throw new RentalError(`Problems must be reported within ${ISSUE_REPORT_WINDOW_HOURS} hours of the return.`);
  }
  return { ...rental, conditionIssue: description.trim() };
}

export function reportNoShow(rental: Rental, actorId: string, now: Date): Rental {
  if (actorId !== rental.lenderId && actorId !== rental.borrowerId) {
    throw new RentalError('Only people in this borrow can report a no-show.');
  }
  if (!canReportNoShow(rental, now)) {
    throw new RentalError('You can report a no-show once the pickup day has started.');
  }
  return { ...rental, status: 'no_show', noShowReportedBy: actorId };
}

// ---- Derived data --------------------------------------------------------------------------

/**
 * The distinct listings a user has actually borrowed (picked up or returned), most recently
 * borrowed first. An item borrowed more than once appears once, at its latest borrow.
 * Rentals whose listing no longer exists are skipped.
 */
export function borrowedListings(rentals: Rental[], listings: Listing[], borrowerId: string): Listing[] {
  const latestFirst = rentals
    .filter(
      (rental) =>
        rental.borrowerId === borrowerId && (rental.status === 'picked_up' || rental.status === 'returned')
    )
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const seen = new Set<string>();
  const result: Listing[] = [];
  for (const rental of latestFirst) {
    if (seen.has(rental.listingId)) continue;
    seen.add(rental.listingId);
    const listing = listings.find((candidate) => candidate.id === rental.listingId);
    if (listing) result.push(listing);
  }
  return result;
}

/** Completed borrows, counting repeat borrows of the same item. */
export function borrowCount(rentals: Rental[], borrowerId: string) {
  return rentals.filter((rental) => rental.borrowerId === borrowerId && rental.status === 'returned').length;
}

/** Completed lends. */
export function lendCount(rentals: Rental[], lenderId: string) {
  return rentals.filter((rental) => rental.lenderId === lenderId && rental.status === 'returned').length;
}

// ---- Store ---------------------------------------------------------------------------------

export const subscribeToRentals = rentalsStore.subscribe;
export const getRentalsSnapshot = rentalsStore.get;

export function getRentalSnapshot(id: string) {
  return rentalsStore.get().find((rental) => rental.id === id);
}

export function setRentals(rentals: Rental[]) {
  rentalsStore.set(rentals);
}

/**
 * Puts a rental row from the database in the store, with any handoff code the signed-in
 * user holds. Used after each change here and for Realtime updates in sync.ts.
 */
export async function putRentalRow(row: RentalRow): Promise<Rental> {
  const codes: RentalCodeRow[] =
    row.status === 'accepted' || row.status === 'picked_up'
      ? unwrap(await supabase.from('rental_codes').select('rental_id, kind, code').eq('rental_id', row.id))
      : [];
  const rental = toRental(row, codes);
  rentalsStore.set(upsertById(rentalsStore.get(), rental));
  return rental;
}

function findOrThrow(id: string) {
  const rental = getRentalSnapshot(id);
  if (!rental) throw new RentalError('Borrow not found.');
  return rental;
}

/** Runs one of the borrow database functions and stores the updated borrow. */
async function callRentalFunction(name: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(name, args).single<RentalRow>();
  if (error) throw new RentalError(error.message);
  return putRentalRow(data);
}

function formatRange(startDate: string, endDate: string) {
  const format = (date: string) =>
    new Date(`${date}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return startDate === endDate ? format(startDate) : `${format(startDate)} – ${format(endDate)}`;
}

/** Sends a borrow request and posts it in the chat with the lender. */
export async function requestBorrow(request: BorrowRequest & { message?: string }): Promise<Rental> {
  const listing = getListingSnapshot(request.listingId);
  if (!listing) throw new RentalError('Listing not found.');
  const borrowerId = getCurrentUserId();
  assertCanTransact(borrowerId, new Date());
  assertNotBlocked(borrowerId, listing.ownerId);
  validateRequest(rentalsStore.get(), listing, borrowerId, request, toDateString(new Date()));

  const rental = await callRentalFunction('request_rental', {
    target_listing_id: listing.id,
    start_on: request.startDate,
    end_on: request.endDate,
    spot: request.pickupSpot,
  });

  const conversation = await getOrCreateConversation(listing.id);
  const note = request.message?.trim();
  await sendMessage(
    conversation.id,
    `Requested to borrow ${formatRange(rental.startDate, rental.endDate)}, pickup at ${rental.pickupSpot}.` +
      (note ? `\n\n${note}` : '')
  );
  return rental;
}

export async function acceptRequest(id: string) {
  assertCanTransact(getCurrentUserId(), new Date());
  // The server generates the codes; these placeholders only let the local check run.
  accept(rentalsStore.get(), findOrThrow(id), getCurrentUserId(), { pickupCode: '', returnCode: '' });
  return callRentalFunction('accept_rental', { target_id: id });
}

export async function declineRequest(id: string) {
  decline(findOrThrow(id), getCurrentUserId());
  return callRentalFunction('decline_rental', { target_id: id });
}

export async function cancelBorrow(id: string) {
  cancel(findOrThrow(id), getCurrentUserId());
  return callRentalFunction('cancel_rental', { target_id: id });
}

/**
 * The person entering a code never has it (only the one showing it does), so the code itself
 * is only checked on the server.
 */
export async function submitPickupCode(id: string, code: string) {
  return callRentalFunction('confirm_pickup', { target_id: id, entered_code: code });
}

export async function submitReturnCode(id: string, code: string) {
  return callRentalFunction('confirm_return', { target_id: id, entered_code: code });
}

export async function reportConditionIssue(id: string, description: string) {
  reportIssue(findOrThrow(id), getCurrentUserId(), description, new Date());
  return callRentalFunction('report_condition_issue', { target_id: id, description });
}

export async function reportMissedPickup(id: string) {
  reportNoShow(findOrThrow(id), getCurrentUserId(), new Date());
  return callRentalFunction('report_no_show', { target_id: id });
}

/** Booked date ranges for a listing, for showing availability. */
export function bookedRanges(listingId: string) {
  return rentalsStore
    .get()
    .filter((rental) => rental.listingId === listingId && BOOKED.includes(rental.status))
    .map((rental) => ({ startDate: rental.startDate, endDate: rental.endDate }));
}

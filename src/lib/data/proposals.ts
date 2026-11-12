/**
 * Change plans and counter-offers on borrows. While a request waits, the borrower edits it
 * directly and the lender can counter it. Once confirmed, either person can propose new plans
 * and the other accepts or declines. The database checks every change (see
 * supabase/migrations/20261111120000_rental_proposals.sql).
 */
import { supabase } from '../supabase';
import { formatPrice, formatTime } from '../format';
import { getOrCreateConversation, sendMessage } from './messages';
import { putRentalRow } from './rentals';
import { toRentalProposal, unwrap, type RentalProposalRow, type RentalRow } from './rows';
import { createStore } from './store';
import type { PickupSpot, Rental, RentalProposal } from './types';

const proposalsStore = createStore<RentalProposal[]>([]);

export const subscribeToProposals = proposalsStore.subscribe;
export const getProposalsSnapshot = proposalsStore.get;

export function setProposals(proposals: RentalProposal[]) {
  proposalsStore.set(proposals);
}

export function putProposal(proposal: RentalProposal) {
  const rest = proposalsStore.get().filter((existing) => existing.id !== proposal.id);
  proposalsStore.set([...rest, proposal]);
}

/** The terms a borrow runs on, and what a proposal changes them to. */
export type BorrowTerms = {
  startDate: string;
  endDate: string;
  pickupTime?: string;
  returnTime?: string;
  pickupSpot: PickupSpot;
  pricePerDay: number;
};

export type TermField = keyof BorrowTerms;

/** What a person can do to a borrow right now: edit their request, counter it, or change plans. */
export type ProposalKind = 'edit' | 'counter' | 'change';

export function proposalKind(rental: Rental, userId: string): ProposalKind | null {
  if (rental.status === 'requested') return rental.borrowerId === userId ? 'edit' : 'counter';
  if (rental.status === 'accepted') return 'change';
  return null;
}

/** The borrow's open proposal, if any. There's at most one at a time. */
export function openProposal(proposals: RentalProposal[], rentalId: string) {
  return proposals.find((proposal) => proposal.rentalId === rentalId && proposal.status === 'pending');
}

export function termsOf(rental: Rental, listingPricePerDay: number): BorrowTerms {
  return {
    startDate: rental.startDate,
    endDate: rental.endDate,
    pickupTime: rental.pickupTime,
    returnTime: rental.returnTime,
    pickupSpot: rental.pickupSpot,
    pricePerDay: rental.offeredPricePerDay ?? listingPricePerDay,
  };
}

/** Which terms differ, in display order. */
export function changedTerms(current: BorrowTerms, proposed: BorrowTerms): TermField[] {
  const fields: TermField[] = ['startDate', 'endDate', 'pickupTime', 'returnTime', 'pickupSpot', 'pricePerDay'];
  return fields.filter((field) => (current[field] ?? null) !== (proposed[field] ?? null));
}

function shortDate(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

/** e.g. "Sat, Nov 8, 4:00 PM → Sun, Nov 9, 6:00 PM at Gregory Gym, $6/day". */
export function describeTerms(terms: BorrowTerms) {
  const at = (date: string, time?: string) => `${shortDate(date)}${time ? `, ${formatTime(time)}` : ''}`;
  return `${at(terms.startDate, terms.pickupTime)} → ${at(terms.endDate, terms.returnTime)} at ${terms.pickupSpot}, ${formatPrice(terms.pricePerDay)}/day`;
}

async function reloadBorrow(rentalId: string) {
  const [rentalRow, proposalRows] = await Promise.all([
    supabase.from('rentals').select().eq('id', rentalId).single<RentalRow>(),
    supabase.from('rental_proposals').select().eq('rental_id', rentalId).returns<RentalProposalRow[]>(),
  ]);
  await putRentalRow(unwrap(rentalRow));
  const others = proposalsStore.get().filter((proposal) => proposal.rentalId !== rentalId);
  proposalsStore.set([...others, ...unwrap(proposalRows).map(toRentalProposal)]);
}

/** Posts a line in the borrow's chat, so the other person sees the change there too. */
async function tellChat(rental: Rental, text: string) {
  const conversation = await getOrCreateConversation(rental.listingId, rental.borrowerId);
  await sendMessage(conversation.id, text);
}

/**
 * Edits a waiting request (borrower), counters it (lender), or proposes new plans for a confirmed
 * borrow (either person). The database checks the terms and throws a message fit to show.
 */
export async function proposeChange(rental: Rental, userId: string, terms: BorrowTerms, note: string) {
  const kind = proposalKind(rental, userId);
  if (!kind) throw new Error('This borrow can’t be changed anymore.');
  const { error } = await supabase.rpc('propose_rental_change', {
    target_id: rental.id,
    start_on: terms.startDate,
    end_on: terms.endDate,
    spot: terms.pickupSpot,
    pickup_at: terms.pickupTime ?? null,
    return_at: terms.returnTime ?? null,
    per_day: terms.pricePerDay,
    message: note.trim(),
  });
  if (error) throw new Error(error.message);
  await reloadBorrow(rental.id);
  const lead = kind === 'edit' ? 'Updated my request' : kind === 'counter' ? 'Counter-offer' : 'Proposed new plans';
  await tellChat(rental, `${lead}: ${describeTerms(terms)}.${note.trim() ? `\n\n${note.trim()}` : ''}`);
}

export async function respondToProposal(rental: Rental, proposal: RentalProposal, accept: boolean) {
  const { data, error } = await supabase
    .rpc('respond_to_rental_proposal', { target_id: proposal.id, accept })
    .single<RentalRow>();
  if (error) throw new Error(error.message);
  await putRentalRow(data);
  await reloadBorrow(rental.id);
  const counter = rental.status === 'requested';
  await tellChat(
    rental,
    accept
      ? counter
        ? 'Accepted your counter-offer. See you at pickup!'
        : 'Accepted the new plans.'
      : counter
        ? 'Declined your counter-offer.'
        : 'Declined the new plans. We’re keeping the original ones.'
  );
}

export async function withdrawProposal(rental: Rental, proposal: RentalProposal) {
  const { error } = await supabase.rpc('withdraw_rental_proposal', { target_id: proposal.id });
  if (error) throw new Error(error.message);
  await reloadBorrow(rental.id);
}

/**
 * Loads everything the signed-in user can see from Supabase into the stores, and keeps chats
 * and borrows live with a Realtime subscription. The app is small enough to load it all at
 * once; move to per-screen queries if it grows past a few thousand rows.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import { reloadListing, setListings } from './listings';
import { putConversation, putMessage, setConversations, setMessages } from './messages';
import { overturnedKey, setBlocks, setOverturned, setReports } from './moderation';
import { putRentalRow, setRentals } from './rentals';
import { putSale, setSales } from './sales';
import { setReviews } from './reviews';
import {
  toAppeal,
  toBlock,
  toConversation,
  toListing,
  toMessage,
  toRental,
  toReport,
  toReview,
  toSale,
  toRentalPhoto,
  toRentalProposal,
  toSave,
  toShelves,
  toUpheldReport,
  toUser,
  unwrap,
  type AppealRow,
  type BlockRow,
  type ConversationRow,
  type ListingRow,
  type MessageRow,
  type ProfileRow,
  type RentalCodeRow,
  type RentalPhotoRow,
  type RentalProposalRow,
  type RentalRow,
  type ReportRow,
  type ReviewRow,
  type SaleRow,
  type SaveRow,
  type ShelfItemRow,
  type ShelfRow,
  type UpheldReportRow,
} from './rows';
import { putProposal, setProposals } from './proposals';
import { putAppeal, setAppeals } from './appeals';
import { setReads } from './reads';
import { setSavedSearches, toSavedSearch } from './saved-searches';
import { putRentalPhoto, setRentalPhotos } from './rental-photos';
import { setSaves } from './saves';
import { setShelves } from './shelves';
import { setUsers } from './users';

let channel: RealtimeChannel | null = null;

/** Loads all data for the signed-in user. `email` is theirs (other people's aren't public). */
export async function loadAppData(userId: string, email: string) {
  const [profiles, listings, rentals, sales, codes, conversations, messages, reviews, saves, saveCounts, reports, upheld, blocks, shelves, shelfItems, proposals, rentalPhotos, reads, savedSearches, appeals, overturned] =
    await Promise.all([
      supabase.from('profiles').select().returns<ProfileRow[]>(),
      supabase.from('listings').select().returns<ListingRow[]>(),
      supabase.rpc('public_rentals'),
      supabase.rpc('public_sales'),
      supabase.from('rental_codes').select('rental_id, kind, code').returns<RentalCodeRow[]>(),
      supabase.from('conversations').select().returns<ConversationRow[]>(),
      supabase.from('messages').select().returns<MessageRow[]>(),
      supabase.from('reviews').select().returns<ReviewRow[]>(),
      supabase.from('saves').select().eq('user_id', userId).returns<SaveRow[]>(),
      supabase.rpc('save_counts'),
      supabase.from('reports').select().returns<ReportRow[]>(),
      supabase.rpc('upheld_reports'),
      supabase.from('blocks').select().returns<BlockRow[]>(),
      supabase.from('shelves').select().eq('owner_id', userId).returns<ShelfRow[]>(),
      supabase.from('shelf_items').select().returns<ShelfItemRow[]>(),
      supabase.from('rental_proposals').select().returns<RentalProposalRow[]>(),
      supabase.from('rental_photos').select().returns<RentalPhotoRow[]>(),
      supabase
        .from('conversation_reads')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId)
        .returns<{ conversation_id: string; last_read_at: string }[]>(),
      supabase.from('saved_searches').select().eq('user_id', userId),
      supabase.from('appeals').select().returns<AppealRow[]>(),
      supabase.rpc('overturned_strikes'),
    ]);

  setUsers(unwrap(profiles).map((row) => toUser(row, row.id === userId ? email : '')));
  setListings(unwrap(listings).map(toListing));
  const codeRows = unwrap(codes);
  const rentalRows: RentalRow[] = unwrap(rentals);
  setRentals(rentalRows.map((row) => toRental(row, codeRows)));
  const saleRows: SaleRow[] = unwrap(sales);
  setSales(saleRows.map(toSale));
  setConversations(unwrap(conversations).map(toConversation));
  setMessages(unwrap(messages).map(toMessage));
  setReviews(unwrap(reviews).map(toReview));
  const countRows: { listing_id: string; count: number }[] = unwrap(saveCounts);
  setSaves(
    unwrap(saves).map(toSave),
    Object.fromEntries(countRows.map((row) => [row.listing_id, Number(row.count)]))
  );
  // Full reports win over the strike-only copies of the same report.
  const fullReports = unwrap(reports).map(toReport);
  const fullIds = new Set(fullReports.map((report) => report.id));
  const upheldRows: UpheldReportRow[] = unwrap(upheld);
  setReports([...fullReports, ...upheldRows.filter((row) => !fullIds.has(row.id)).map(toUpheldReport)]);
  setBlocks(unwrap(blocks).map(toBlock));
  setShelves(toShelves(unwrap(shelves), unwrap(shelfItems)));
  setProposals(unwrap(proposals).map(toRentalProposal));
  setRentalPhotos(unwrap(rentalPhotos).map(toRentalPhoto));
  setReads(Object.fromEntries(unwrap(reads).map((row) => [row.conversation_id, row.last_read_at])));
  setSavedSearches((unwrap(savedSearches) ?? []).map(toSavedSearch));
  const overturnedRows: { user_id: string; source: 'no_show' | 'late_return' | 'report'; ref_id: string }[] =
    unwrap(overturned) ?? [];
  setOverturned(overturnedRows.map((row) => overturnedKey(row.user_id, row.source, row.ref_id)));
  setAppeals(unwrap(appeals).map(toAppeal));
}

/** Streams new chats, messages, and borrow changes. Database policies limit it to the user's own. */
export function startLiveUpdates() {
  stopLiveUpdates();
  channel = supabase
    .channel('app')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) =>
      putConversation(toConversation(payload.new as ConversationRow))
    )
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) =>
      putMessage(toMessage(payload.new as MessageRow))
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rentals' }, (payload) => {
      if (payload.eventType !== 'DELETE') void putRentalRow(payload.new as RentalRow);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_proposals' }, (payload) => {
      if (payload.eventType !== 'DELETE') putProposal(toRentalProposal(payload.new as RentalProposalRow));
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rental_photos' }, (payload) =>
      putRentalPhoto(toRentalPhoto(payload.new as RentalPhotoRow))
    )
    .on('postgres_changes', { event: '*', schema: 'public', table: 'appeals' }, (payload) => {
      if (payload.eventType !== 'DELETE') putAppeal(toAppeal(payload.new as AppealRow));
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
      if (payload.eventType === 'DELETE') return;
      const sale = toSale(payload.new as SaleRow);
      putSale(sale);
      if (sale.status === 'accepted') void reloadListing(sale.listingId);
    })
    .subscribe();
}

export function stopLiveUpdates() {
  if (channel) void supabase.removeChannel(channel);
  channel = null;
}

/** Empties every store, on sign-out. */
export function clearAppData() {
  stopLiveUpdates();
  setUsers([]);
  setListings([]);
  setRentals([]);
  setSales([]);
  setConversations([]);
  setMessages([]);
  setReviews([]);
  setSaves([], {});
  setReports([]);
  setBlocks([]);
  setShelves([]);
  setProposals([]);
  setRentalPhotos([]);
  setReads({});
  setSavedSearches([]);
  setAppeals([]);
  setOverturned([]);
}

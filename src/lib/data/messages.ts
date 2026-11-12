/**
 * Conversations and messages. Loaded at sign-in by sync.ts; new ones from other people arrive
 * through its Realtime subscription.
 */
import { supabase } from '../supabase';
import { uploadPrivatePhoto } from './photos';
import { assertNotBlocked } from './moderation';
import { getCurrentUserId } from './session';
import { getListingSnapshot } from './listings';
import { toConversation, toMessage, unwrap, type ConversationRow, type MessageRow } from './rows';
import { createStore, upsertById } from './store';
import type { Conversation, Message } from './types';

const conversationsStore = createStore<Conversation[]>([]);
const messagesStore = createStore<Message[]>([]);

export const subscribeToConversations = conversationsStore.subscribe;
export const getConversationsSnapshot = conversationsStore.get;
export const subscribeToMessages = messagesStore.subscribe;
export const getMessagesSnapshot = messagesStore.get;

export function setConversations(conversations: Conversation[]) {
  conversationsStore.set(conversations);
}

/** Adds or replaces a conversation, e.g. one someone else just started. */
export function putConversation(conversation: Conversation) {
  conversationsStore.set(upsertById(conversationsStore.get(), conversation));
}

/** Kept oldest first. */
export function setMessages(messages: Message[]) {
  messagesStore.set([...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
}

/** Adds a message once, even if it arrives both from sending and from Realtime. */
export function putMessage(message: Message) {
  setMessages(upsertById(messagesStore.get(), message));
}

/**
 * Finds the conversation between a listing's owner and a borrower about that listing, or
 * starts one. The borrower defaults to the current user; a lender passes the borrower's id.
 * The current user must be one of the two people.
 */
export async function getOrCreateConversation(listingId: string, borrowerId?: string): Promise<Conversation> {
  const listing = getListingSnapshot(listingId);
  if (!listing) {
    throw new Error('Listing not found.');
  }
  const userId = getCurrentUserId();
  const borrower = borrowerId ?? userId;
  if (borrower === listing.ownerId) {
    throw new Error("You can't message yourself about your own listing.");
  }
  if (userId !== borrower && userId !== listing.ownerId) {
    throw new Error('You’re not part of this conversation.');
  }
  assertNotBlocked(borrower, listing.ownerId);

  const existing = conversationsStore
    .get()
    .find(
      (conversation) =>
        conversation.listingId === listingId &&
        conversation.participantIds.includes(borrower) &&
        conversation.participantIds.includes(listing.ownerId)
    );
  if (existing) return existing;

  const inserted = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, borrower_id: borrower, owner_id: listing.ownerId })
    .select()
    .single<ConversationRow>();
  // 23505 = unique violation: the other person started this chat a moment ago, so use theirs.
  const row =
    inserted.error?.code === '23505'
      ? unwrap(
          await supabase
            .from('conversations')
            .select()
            .eq('listing_id', listingId)
            .eq('borrower_id', borrower)
            .single<ConversationRow>()
        )
      : unwrap(inserted);
  const conversation = toConversation(row);
  putConversation(conversation);
  return conversation;
}

export async function sendMessage(conversationId: string, text: string, photoUri?: string): Promise<Message> {
  const conversation = conversationsStore.get().find((candidate) => candidate.id === conversationId);
  if (!conversation) throw new Error('Conversation not found.');
  const senderId = getCurrentUserId();
  if (!conversation.participantIds.includes(senderId)) {
    throw new Error('Only people in this conversation can send messages.');
  }
  assertNotBlocked(...conversation.participantIds);
  const imagePath = photoUri ? await uploadPrivatePhoto('chat-photos', conversationId, senderId, photoUri) : null;
  const row = unwrap(
    await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text: text.trim(),
        ...(imagePath ? { image_path: imagePath } : {}),
      })
      .select()
      .single<MessageRow>()
  );
  const message = toMessage(row);
  putMessage(message);
  return message;
}

/**
 * Conversations and messages. With Supabase, new messages would arrive through a Realtime
 * subscription on the messages table instead of this in-memory store.
 */
import { assertNotBlocked } from './moderation';
import { getCurrentUserId } from './session';
import { getListingSnapshot } from './listings';
import { MOCK_CONVERSATIONS, MOCK_MESSAGES } from './mock-data';
import { createStore } from './store';
import type { Conversation, Message } from './types';

const conversationsStore = createStore<Conversation[]>(MOCK_CONVERSATIONS);
const messagesStore = createStore<Message[]>(MOCK_MESSAGES);

export const subscribeToConversations = conversationsStore.subscribe;
export const getConversationsSnapshot = conversationsStore.get;
export const subscribeToMessages = messagesStore.subscribe;
export const getMessagesSnapshot = messagesStore.get;

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

  const conversation: Conversation = {
    id: `c${Date.now()}`,
    listingId,
    participantIds: [borrower, listing.ownerId],
    createdAt: new Date().toISOString(),
  };
  conversationsStore.set([...conversationsStore.get(), conversation]);
  return conversation;
}

export async function sendMessage(conversationId: string, text: string): Promise<Message> {
  const conversation = conversationsStore.get().find((candidate) => candidate.id === conversationId);
  if (!conversation) throw new Error('Conversation not found.');
  if (!conversation.participantIds.includes(getCurrentUserId())) {
    throw new Error('Only people in this conversation can send messages.');
  }
  assertNotBlocked(...conversation.participantIds);
  const message: Message = {
    id: `m${Date.now()}`,
    conversationId,
    senderId: getCurrentUserId(),
    text: text.trim(),
    createdAt: new Date().toISOString(),
  };
  messagesStore.set([...messagesStore.get(), message]);
  return message;
}

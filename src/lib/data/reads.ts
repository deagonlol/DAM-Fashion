/**
 * Unread messages: when the signed-in user last read each chat. Messages from the other person
 * after that count as unread. A chat with no record yet counts everything from them as unread.
 */
import { supabase } from '../supabase';
import { getCurrentUserId } from './session';
import { createStore } from './store';
import type { Message } from './types';

/** Conversation id → when it was last read (ISO). */
const readsStore = createStore<Record<string, string>>({});

export const subscribeToReads = readsStore.subscribe;
export const getReadsSnapshot = readsStore.get;

export function setReads(reads: Record<string, string>) {
  readsStore.set(reads);
}

/** How many messages in the thread arrived from someone else after it was last read. */
export function unreadCount(thread: Message[], userId: string, lastReadAt: string | undefined) {
  return thread.filter((message) => message.senderId !== userId && (!lastReadAt || message.createdAt > lastReadAt))
    .length;
}

/** Marks the chat read up to now. Updates the dot right away; the server catches up. */
export async function markConversationRead(conversationId: string) {
  const now = new Date().toISOString();
  readsStore.set({ ...readsStore.get(), [conversationId]: now });
  await supabase
    .from('conversation_reads')
    .upsert({ user_id: getCurrentUserId(), conversation_id: conversationId, last_read_at: now });
}

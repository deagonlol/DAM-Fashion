import { useMemo, useSyncExternalStore } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useCurrentUser } from '@/hooks/use-session';
import {
  getConversationsSnapshot,
  getMessagesSnapshot,
  subscribeToConversations,
  subscribeToMessages,
} from '@/lib/data/messages';
import type { Conversation, Listing, Message } from '@/lib/data/types';
import { getReadsSnapshot, subscribeToReads, unreadCount } from '@/lib/data/reads';
import { getUsersSnapshot, subscribeToUsers } from '@/lib/data/users';

export type ConversationSummary = {
  conversation: Conversation;
  otherUserName: string;
  otherUserAvatarUrl: string | undefined;
  listing: Listing | undefined;
  lastMessage: Message | undefined;
  /** Messages from the other person since this user last opened the chat. */
  unread: number;
  /** Lending when the signed-in user owns the listing. Missing listings count as borrowing. */
  role: 'lender' | 'borrower';
};

function useAllMessages() {
  return useSyncExternalStore(subscribeToMessages, getMessagesSnapshot, getMessagesSnapshot);
}

/** The current user's conversations, most recently active first. */
export function useConversationSummaries(): ConversationSummary[] {
  const currentUser = useCurrentUser();
  const conversations = useSyncExternalStore(
    subscribeToConversations,
    getConversationsSnapshot,
    getConversationsSnapshot
  );
  const messages = useAllMessages();
  const users = useSyncExternalStore(subscribeToUsers, getUsersSnapshot, getUsersSnapshot);
  const listings = useListings();
  const reads = useSyncExternalStore(subscribeToReads, getReadsSnapshot, getReadsSnapshot);

  return useMemo(() => {
    const summaries = conversations
      .filter((conversation) => conversation.participantIds.includes(currentUser.id))
      .map((conversation) => {
        const otherId = conversation.participantIds.find((id) => id !== currentUser.id);
        const thread = messages.filter((message) => message.conversationId === conversation.id);
        const otherUser = users.find((user) => user.id === otherId);
        const listing = listings.find((item) => item.id === conversation.listingId);
        const role: ConversationSummary['role'] = listing?.ownerId === currentUser.id ? 'lender' : 'borrower';
        return {
          conversation,
          otherUserName: otherUser?.name ?? 'Unknown',
          otherUserAvatarUrl: otherUser?.avatarUrl,
          listing,
          lastMessage: thread.at(-1),
          unread: unreadCount(thread, currentUser.id, reads[conversation.id]),
          role,
        };
      });
    const activity = (summary: ConversationSummary) => summary.lastMessage?.createdAt ?? summary.conversation.createdAt;
    return summaries.sort((a, b) => activity(b).localeCompare(activity(a)));
  }, [conversations, messages, users, listings, reads, currentUser.id]);
}

export function useConversation(id: string | undefined) {
  const conversations = useSyncExternalStore(
    subscribeToConversations,
    getConversationsSnapshot,
    getConversationsSnapshot
  );
  return useMemo(() => conversations.find((conversation) => conversation.id === id), [conversations, id]);
}

/** Messages in a conversation, oldest first. */
export function useMessages(conversationId: string | undefined) {
  const messages = useAllMessages();
  return useMemo(
    () => messages.filter((message) => message.conversationId === conversationId),
    [messages, conversationId]
  );
}

/** Chats with unread messages, for the Inbox tab badge. */
export function useUnreadChatCount() {
  const summaries = useConversationSummaries();
  return useMemo(() => summaries.filter((summary) => summary.unread > 0).length, [summaries]);
}

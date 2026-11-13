/**
 * Everything the notifications screen lists: unread chats, then the same reminders as Home.
 */
import type { Reminder } from './reminders';

export type Notice = {
  key: string;
  title: string;
  detail?: string;
  tone: Reminder['tone'];
  href: string;
};

export type UnreadChat = {
  id: string;
  name: string;
  unread: number;
  preview?: string;
};

export function noticesFor(reminders: Reminder[], chats: UnreadChat[]): Notice[] {
  const messages: Notice[] = chats
    .filter((chat) => chat.unread > 0)
    .map((chat) => ({
      key: `chat-${chat.id}`,
      title: chat.unread === 1 ? `New message from ${chat.name}` : `${chat.unread} new messages from ${chat.name}`,
      detail: chat.preview,
      tone: 'accent' as const,
      href: `/chat/${chat.id}`,
    }));
  return [
    ...messages,
    ...reminders.map((reminder) => ({
      key: reminder.key,
      title: reminder.title,
      detail: reminder.detail,
      tone: reminder.tone,
      href: reminder.href,
    })),
  ];
}

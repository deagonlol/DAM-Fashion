import { unreadCount } from '../reads';
import type { Message } from '../types';

const message = (senderId: string, createdAt: string): Message => ({
  id: createdAt,
  conversationId: 'c1',
  senderId,
  text: 'hi',
  createdAt,
});

describe('unreadCount', () => {
  const thread = [
    message('them', '2026-11-10T10:00:00Z'),
    message('me', '2026-11-10T11:00:00Z'),
    message('them', '2026-11-10T12:00:00Z'),
    message('them', '2026-11-10T13:00:00Z'),
  ];

  it('counts messages from the other person after the last read', () => {
    expect(unreadCount(thread, 'me', '2026-11-10T11:30:00Z')).toBe(2);
    expect(unreadCount(thread, 'me', '2026-11-10T14:00:00Z')).toBe(0);
  });

  it('never counts your own messages', () => {
    expect(unreadCount(thread, 'them', undefined)).toBe(1);
  });

  it('counts everything from them in a chat never opened', () => {
    expect(unreadCount(thread, 'me', undefined)).toBe(3);
  });
});

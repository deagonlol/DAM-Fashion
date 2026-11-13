import { router, type Href } from 'expo-router';
import { useEffect, useMemo } from 'react';

import { useConversationSummaries } from '@/hooks/use-conversations';
import { useListings } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useReminders } from '@/hooks/use-reminders';
import { useRentals } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { noticesFor } from '@/lib/data/notices';
import { notificationPlans } from '@/lib/data/notification-plans';
import { listenForNotificationOpens, syncScheduledNotifications } from '@/lib/schedule-reminders';

/** Unread messages and coming-up reminders, for the notifications screen and the bell badge. */
export function useNotices() {
  const reminders = useReminders();
  const chats = useConversationSummaries();
  return useMemo(
    () =>
      noticesFor(
        reminders,
        chats.map((chat) => ({
          id: chat.conversation.id,
          name: chat.otherUserName,
          unread: chat.unread,
          preview: chat.lastMessage?.text,
        }))
      ),
    [reminders, chats]
  );
}

/** Keeps the device's scheduled pickup and return alerts in step with open borrows. */
export function useScheduleReminders() {
  const user = useCurrentUser();
  const rentals = useRentals();
  const listings = useListings();
  const now = useNow();
  const plans = useMemo(
    () => notificationPlans({ userId: user.id, rentals, listings, now }),
    [user.id, rentals, listings, now]
  );

  useEffect(() => {
    void syncScheduledNotifications(plans);
  }, [plans]);

  useEffect(() => listenForNotificationOpens((url) => router.push(url as Href)), []);
}

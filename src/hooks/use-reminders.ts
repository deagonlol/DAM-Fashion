import { useMemo } from 'react';

import { useListings } from '@/hooks/use-listings';
import { useNow } from '@/hooks/use-now';
import { useProposals } from '@/hooks/use-proposals';
import { useRentals } from '@/hooks/use-rentals';
import { useSales } from '@/hooks/use-sales';
import { useCurrentUser } from '@/hooks/use-session';
import { remindersFor } from '@/lib/data/reminders';

/** What needs the signed-in user soon: overdue returns, today's handoffs, offers to answer. */
export function useReminders() {
  const user = useCurrentUser();
  const rentals = useRentals();
  const sales = useSales();
  const proposals = useProposals();
  const listings = useListings();
  const now = useNow();
  return useMemo(
    () => remindersFor({ userId: user.id, rentals, sales, proposals, listings, now }),
    [user.id, rentals, sales, proposals, listings, now]
  );
}

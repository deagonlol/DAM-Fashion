import { useMemo, useSyncExternalStore } from 'react';

import { useNow } from '@/hooks/use-now';
import { useRentals } from '@/hooks/use-rentals';
import {
  getBlocksSnapshot,
  getReportsSnapshot,
  isBlockedBetween,
  penaltyFor,
  strikesFor,
  subscribeToBlocks,
  subscribeToReports,
  type Penalty,
} from '@/lib/data/moderation';
import { getUsersSnapshot, subscribeToUsers } from '@/lib/data/users';

export function useReports() {
  return useSyncExternalStore(subscribeToReports, getReportsSnapshot);
}

export function useBlocks() {
  return useSyncExternalStore(subscribeToBlocks, getBlocksSnapshot);
}

export function useStrikes(userId: string) {
  const rentals = useRentals();
  const reports = useReports();
  const now = useNow();
  return useMemo(() => strikesFor(userId, rentals, reports, now), [userId, rentals, reports, now]);
}

export function usePenalty(userId: string): Penalty {
  const strikes = useStrikes(userId);
  const now = useNow();
  return useMemo(() => penaltyFor(strikes, now), [strikes, now]);
}

/** Ids of users currently soft-banned or banned, for filtering what others see. */
export function useRestrictedUserIds() {
  const users = useSyncExternalStore(subscribeToUsers, getUsersSnapshot);
  const rentals = useRentals();
  const reports = useReports();
  const now = useNow();
  return useMemo(() => {
    const restricted = new Set<string>();
    for (const user of users) {
      const level = penaltyFor(strikesFor(user.id, rentals, reports, now), now).level;
      if (level === 'soft_ban' || level === 'banned') restricted.add(user.id);
    }
    return restricted;
  }, [users, rentals, reports, now]);
}

/** Whether the viewer blocked this user, and whether either side blocked the other. */
export function useBlockState(viewerId: string, otherId: string | undefined) {
  const blocks = useBlocks();
  return useMemo(
    () => ({
      blockedByMe: blocks.some((block) => block.blockerId === viewerId && block.blockedId === otherId),
      blockedEitherWay: otherId ? isBlockedBetween(blocks, viewerId, otherId) : false,
    }),
    [blocks, viewerId, otherId]
  );
}

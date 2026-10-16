import { useSyncExternalStore } from 'react';

import { getLastSignedInUserSnapshot, getSessionSnapshot, subscribeToSession } from '@/lib/data/auth';
import type { User } from '@/lib/data/types';

/** The signed-in user, or null when signed out. */
export function useSession() {
  return useSyncExternalStore(subscribeToSession, getSessionSnapshot);
}

/**
 * The signed-in user, for screens behind the auth guard. Keeps returning the last user
 * during sign-out, so a screen re-rendering before the guard removes it doesn't crash.
 */
export function useCurrentUser(): User {
  const user = useSyncExternalStore(subscribeToSession, getLastSignedInUserSnapshot);
  if (!user) {
    throw new Error('useCurrentUser called before anyone signed in.');
  }
  return user;
}

/**
 * The signed-in user. Kept separate from auth.ts so data modules can ask "who is signed in?"
 * without importing sign-in logic (which itself depends on moderation).
 */
import { createStore } from './store';
import type { User } from './types';

export class NotSignedInError extends Error {}

const sessionStore = createStore<User | null>(null);
/** Kept after sign-out so screens re-rendering before the auth guard removes them don't crash. */
let lastSignedInUser: User | null = null;

export const subscribeToSession = sessionStore.subscribe;
export const getSessionSnapshot = sessionStore.get;
export const getLastSignedInUserSnapshot = () => sessionStore.get() ?? lastSignedInUser;

export function startSession(user: User) {
  lastSignedInUser = user;
  sessionStore.set(user);
}

export function endSession() {
  sessionStore.set(null);
}

/** The signed-in user's id. Only call from screens behind the auth guard. */
export function getCurrentUserId(): string {
  const user = sessionStore.get();
  if (!user) {
    throw new NotSignedInError('Not signed in.');
  }
  return user.id;
}

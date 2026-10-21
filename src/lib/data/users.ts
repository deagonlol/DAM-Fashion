import { createStore, upsertById } from './store';
import type { User } from './types';

/** Every profile, loaded at sign-in by sync.ts. */
const usersStore = createStore<User[]>([]);

export const subscribeToUsers = usersStore.subscribe;
export const getUsersSnapshot = usersStore.get;

export function setUsers(users: User[]) {
  usersStore.set(users);
}

export async function getUser(id: string): Promise<User | undefined> {
  return getUserSnapshot(id);
}

export function getUserSnapshot(id: string): User | undefined {
  return usersStore.get().find((user) => user.id === id);
}

/** Case-insensitive name search over loaded profiles. */
export async function searchUsers(query: string): Promise<User[]> {
  return usersStore.get().filter((user) => userMatches(user, query));
}

export function userMatches(user: User, query: string) {
  const normalized = query.trim().toLowerCase();
  return user.name.toLowerCase().includes(normalized);
}

/** Adds or replaces a user in the local store (after the database is updated). */
export function putUser(user: User) {
  usersStore.set(upsertById(usersStore.get(), user));
}

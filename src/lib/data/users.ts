import { MOCK_USERS } from './mock-data';
import { createStore } from './store';
import type { User } from './types';

const usersStore = createStore<User[]>(MOCK_USERS);

export const subscribeToUsers = usersStore.subscribe;
export const getUsersSnapshot = usersStore.get;

export async function getUser(id: string): Promise<User | undefined> {
  return getUserSnapshot(id);
}

/** Synchronous lookup for mock data. Becomes async with a backend. */
export function getUserSnapshot(id: string): User | undefined {
  return usersStore.get().find((user) => user.id === id);
}

export function findUserByEmail(email: string): User | undefined {
  const normalized = email.trim().toLowerCase();
  return usersStore.get().find((user) => user.email === normalized);
}

/** Case-insensitive name search. With Supabase this becomes an ilike query on profiles. */
export async function searchUsers(query: string): Promise<User[]> {
  return usersStore.get().filter((user) => userMatches(user, query));
}

export function userMatches(user: User, query: string) {
  const normalized = query.trim().toLowerCase();
  return user.name.toLowerCase().includes(normalized);
}

export function addUser(user: User) {
  usersStore.set([...usersStore.get(), user]);
}

export function updateUser(id: string, patch: Partial<Omit<User, 'id'>>): User | undefined {
  let updated: User | undefined;
  usersStore.set(
    usersStore.get().map((user) => {
      if (user.id !== id) return user;
      updated = { ...user, ...patch };
      return updated;
    })
  );
  return updated;
}

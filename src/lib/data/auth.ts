/**
 * Fake auth. Accounts and the session live in memory, so reloading the app signs you out.
 * Replace with Supabase Auth (which also persists the session) when the backend is set up.
 */
import { MOCK_PASSWORD, MOCK_USERS } from './mock-data';
import { penaltyForUser, restrictionMessage } from './moderation';
import { endSession, getCurrentUserId, startSession } from './session';
import { MAX_BIO_LENGTH, type User } from './types';
import { addUser, findUserByEmail, updateUser } from './users';

export {
  getCurrentUserId,
  getLastSignedInUserSnapshot,
  getSessionSnapshot,
  subscribeToSession,
} from './session';

export const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {}

const passwords = new Map(MOCK_USERS.map((user) => [user.email, MOCK_PASSWORD]));

/** Only UT Austin emails can sign up, as a first step toward student verification. */
export function isUtexasEmail(email: string) {
  return /^[^\s@]+@utexas\.edu$/i.test(email.trim());
}

export const UTEXAS_EMAIL_ERROR = 'DAM Fashion is only for UT students. Use your @utexas.edu email.';

export async function signIn(email: string, password: string): Promise<User> {
  if (!isUtexasEmail(email)) {
    throw new AuthError(UTEXAS_EMAIL_ERROR);
  }
  const user = findUserByEmail(email);
  if (!user || passwords.get(user.email) !== password) {
    throw new AuthError('Incorrect email or password.');
  }
  const penalty = penaltyForUser(user.id, new Date());
  if (penalty.level === 'banned') {
    throw new AuthError(restrictionMessage(penalty) ?? 'This account has been suspended.');
  }
  startSession(user);
  return user;
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!isUtexasEmail(email)) {
    throw new AuthError(UTEXAS_EMAIL_ERROR);
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (findUserByEmail(email)) {
    throw new AuthError('An account with that email already exists.');
  }

  const user: User = {
    id: `u${Date.now()}`,
    name: input.name.trim(),
    email,
    joinedAt: new Date().toISOString(),
  };
  addUser(user);
  passwords.set(email, input.password);
  startSession(user);
  return user;
}

/**
 * Sets the signed-in user's profile photo. With Supabase, upload the image to Storage first
 * and save its public URL here instead of the local file URI.
 */
export async function updateProfilePhoto(uri: string) {
  const updated = updateUser(getCurrentUserId(), { avatarUrl: uri });
  if (updated) startSession(updated);
}

/** Updates the signed-in user's name and bio. */
export async function updateProfile(input: { name: string; bio: string }) {
  const name = input.name.trim();
  const bio = input.bio.trim();
  if (!name) throw new AuthError('Your name can’t be empty.');
  if (bio.length > MAX_BIO_LENGTH) throw new AuthError(`Keep your bio under ${MAX_BIO_LENGTH} characters.`);
  const updated = updateUser(getCurrentUserId(), { name, bio: bio || undefined });
  if (updated) startSession(updated);
  return updated;
}

export async function signOut() {
  endSession();
}

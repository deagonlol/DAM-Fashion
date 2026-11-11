/**
 * Sign-in with Supabase Auth. The session is saved on the device, so restoreSession() signs
 * people back in when the app opens. Only UT emails (utexas.edu or a subdomain like
 * my.utexas.edu) can sign up; the database
 * enforces that too (handle_new_user in supabase/migrations).
 */
import type { User as AuthUser } from '@supabase/supabase-js';

import { supabase } from '../supabase';
import { penaltyForUser, restrictionMessage } from './moderation';
import { deleteAllPhotos, uploadPhoto } from './photos';
import { toUser, unwrap, type ProfileRow } from './rows';
import { endSession, getCurrentUserId, getSessionSnapshot, startSession } from './session';
import { createStore } from './store';
import { clearAppData, loadAppData, startLiveUpdates } from './sync';
import { MAX_BIO_LENGTH, type User } from './types';
import { getUserSnapshot, putUser } from './users';

export { getCurrentUserId, getLastSignedInUserSnapshot, getSessionSnapshot, subscribeToSession } from './session';

export const MIN_PASSWORD_LENGTH = 8;

export class AuthError extends Error {}

/** Signed up, but the email isn't confirmed yet. Screens send them to enter the emailed code. */
export class ConfirmEmailError extends AuthError {}

/** Only UT Austin emails can sign up, as a first step toward student verification. */
/** utexas.edu or any UT subdomain: my.utexas.edu, eid.utexas.edu, cs.utexas.edu, ... */
export function isUtexasEmail(email: string) {
  return /^[^\s@]+@([a-z0-9-]+\.)*utexas\.edu$/i.test(email.trim());
}

export const UTEXAS_EMAIL_ERROR = 'Lendr is only for UT students. Use your UT email (ending in utexas.edu).';

/** False until restoreSession() has checked for a saved session, so the app doesn't flash sign-in. */
const authReadyStore = createStore(false);
export const subscribeToAuthReady = authReadyStore.subscribe;
export const getAuthReadySnapshot = authReadyStore.get;

/** Loads the user's data and starts the session, unless they're banned. */
async function enterApp(authUser: AuthUser): Promise<User> {
  await loadAppData(authUser.id, authUser.email ?? '');
  const user = getUserSnapshot(authUser.id);
  if (!user) {
    await supabase.auth.signOut();
    clearAppData();
    throw new AuthError('Your profile couldn’t be loaded. Try again.');
  }
  const penalty = penaltyForUser(user.id, new Date());
  if (penalty.level === 'banned') {
    await supabase.auth.signOut();
    clearAppData();
    throw new AuthError(restrictionMessage(penalty) ?? 'This account has been suspended.');
  }
  startSession(user);
  startLiveUpdates();
  return user;
}

/** Call once when the app opens: signs back in with the saved session, if any. */
export async function restoreSession() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) await enterApp(data.session.user);
  } catch {
    // Banned, offline, or the saved session expired: start signed out.
    clearAppData();
  } finally {
    authReadyStore.set(true);
  }
}

// Sessions can also end without signOut(), e.g. a refresh token that's no longer valid.
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT' && getSessionSnapshot()) {
    clearAppData();
    endSession();
  }
});

export async function signIn(email: string, password: string): Promise<User> {
  if (!isUtexasEmail(email)) {
    throw new AuthError(UTEXAS_EMAIL_ERROR);
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error) {
    if (error.code === 'email_not_confirmed') {
      throw new ConfirmEmailError('Confirm your email first. Enter the code we emailed you.');
    }
    throw new AuthError('Incorrect email or password.');
  }
  return enterApp(data.user);
}

export async function signUp(input: { name: string; email: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (!isUtexasEmail(email)) {
    throw new AuthError(UTEXAS_EMAIL_ERROR);
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) {
    throw new AuthError(
      error.code === 'user_already_exists' ? 'An account with that email already exists.' : error.message
    );
  }
  // With email confirmation on (the Supabase default), there's no session until they click the link.
  if (!data.user || !data.session) {
    throw new ConfirmEmailError(`Almost done! We sent a code to ${email}.`);
  }
  return enterApp(data.user);
}

/**
 * Checks the code from the sign-up email and signs in. Supabase's "Confirm signup" email
 * template must include {{ .Token }} so the code shows up in the email.
 */
export async function confirmSignUp(email: string, code: string): Promise<User> {
  const address = email.trim().toLowerCase();
  const token = code.trim();
  let { data, error } = await supabase.auth.verifyOtp({ email: address, token, type: 'signup' });
  // Newer Supabase projects issue sign-up codes as plain email codes.
  if (error) ({ data, error } = await supabase.auth.verifyOtp({ email: address, token, type: 'email' }));
  if (error || !data.user || !data.session) {
    throw new AuthError('That code is wrong or expired. Send a new one.');
  }
  return enterApp(data.user);
}

/** Sends the sign-up confirmation code again. Supabase allows one per address per minute. */
export async function resendConfirmation(email: string) {
  const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
  if (error) {
    throw new AuthError(
      error.code === 'over_email_send_rate_limit'
        ? 'Too many emails sent. Wait a minute and try again.'
        : 'Couldn’t send the email. Try again.'
    );
  }
}

/**
 * Emails a reset code. Supabase's "Reset Password" email template must include {{ .Token }}
 * so the code shows up in the email.
 */
export async function sendPasswordReset(email: string) {
  if (!isUtexasEmail(email)) {
    throw new AuthError(UTEXAS_EMAIL_ERROR);
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) {
    throw new AuthError(
      error.code === 'over_email_send_rate_limit'
        ? 'Too many emails sent. Wait a few minutes and try again.'
        : 'Couldn’t send the email. Try again.'
    );
  }
}

/** Checks the emailed code, sets the new password, and signs in. */
export async function resetPassword(input: { email: string; code: string; password: string }): Promise<User> {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    throw new AuthError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  // A code can only be used once, so if setting the password failed last time, reuse that session.
  const { data: existing } = await supabase.auth.getSession();
  let authUser = existing.session?.user.email === email ? existing.session.user : null;
  if (!authUser) {
    const { data, error } = await supabase.auth.verifyOtp({ email, token: input.code.trim(), type: 'recovery' });
    if (error || !data.user) {
      throw new AuthError('That code is wrong or expired. Send a new one.');
    }
    authUser = data.user;
  }
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) {
    throw new AuthError(
      error.code === 'same_password'
        ? 'Pick a password different from your old one.'
        : 'Couldn’t save the password. Try again.'
    );
  }
  return enterApp(authUser);
}

/** Saves profile changes and updates the stores and session to match. */
async function saveProfile(changes: Record<string, unknown>) {
  const userId = getCurrentUserId();
  const row = unwrap(
    await supabase.from('profiles').update(changes).eq('id', userId).select().single<ProfileRow>(),
    AuthError
  );
  const updated = toUser(row, getSessionSnapshot()?.email);
  putUser(updated);
  startSession(updated);
  return updated;
}

/** Uploads a new profile photo and saves its URL. */
export async function updateProfilePhoto(uri: string) {
  const url = await uploadPhoto('avatars', getCurrentUserId(), uri);
  return saveProfile({ avatar_url: url });
}

/** Updates the signed-in user's name and bio. */
export async function updateProfile(input: { name: string; bio: string }) {
  getCurrentUserId();
  const name = input.name.trim();
  const bio = input.bio.trim();
  if (!name) throw new AuthError('Your name can’t be empty.');
  if (bio.length > MAX_BIO_LENGTH) throw new AuthError(`Keep your bio under ${MAX_BIO_LENGTH} characters.`);
  return saveProfile({ name, bio });
}

/** Deletes the account and everything in it, then signs out. */
export async function deleteAccount() {
  const userId = getCurrentUserId();
  const { error } = await supabase.rpc('delete_account');
  if (error) throw new AuthError(error.message);
  // Photos aren't tied to the account in the database, so clear them out too. The account is
  // already gone if this fails, so don't block signing out on it.
  await deleteAllPhotos(userId).catch(() => {});
  await signOut();
}

export async function signOut() {
  endSession();
  clearAppData();
  await supabase.auth.signOut();
}

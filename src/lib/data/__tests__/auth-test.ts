import {
  getSessionSnapshot,
  isUtexasEmail,
  signIn,
  signOut,
  signUp,
  updateProfile,
  UTEXAS_EMAIL_ERROR,
} from '../auth';
import { getUserSnapshot } from '../users';

afterEach(async () => {
  await signOut();
});

describe('isUtexasEmail', () => {
  it.each(['alex@utexas.edu', 'ALEX@UTEXAS.EDU', '  alex@utexas.edu  '])('accepts %s', (email) => {
    expect(isUtexasEmail(email)).toBe(true);
  });

  it.each([
    'alex@gmail.com',
    'alex@utexas.edu.evil.com',
    'alex@fakeutexas.edu',
    'alex@cs.utexas.edu', // department subdomains aren't allowed yet
    '@utexas.edu',
    'utexas.edu',
    '',
  ])('rejects %s', (email) => {
    expect(isUtexasEmail(email)).toBe(false);
  });
});

describe('signIn', () => {
  it('rejects non-UT emails with a clear message and stays signed out', async () => {
    await expect(signIn('alex@gmail.com', 'password')).rejects.toThrow(UTEXAS_EMAIL_ERROR);
    expect(getSessionSnapshot()).toBeNull();
  });

  it('rejects a wrong password', async () => {
    await expect(signIn('alex@utexas.edu', 'wrong')).rejects.toThrow('Incorrect email or password.');
    expect(getSessionSnapshot()).toBeNull();
  });

  it('signs in a UT account regardless of email case', async () => {
    const user = await signIn('Alex@UTexas.edu', 'password');
    expect(user.id).toBe('u1');
    expect(getSessionSnapshot()?.id).toBe('u1');
  });
});

describe('signUp', () => {
  it('rejects non-UT emails', async () => {
    await expect(signUp({ name: 'Sam', email: 'sam@gmail.com', password: 'longenough' })).rejects.toThrow(
      UTEXAS_EMAIL_ERROR
    );
  });

  it('rejects short passwords', async () => {
    await expect(signUp({ name: 'Sam', email: 'sam@utexas.edu', password: 'short' })).rejects.toThrow(
      'at least 8 characters'
    );
  });

  it('rejects an email that already has an account', async () => {
    await expect(signUp({ name: 'Alex', email: 'alex@utexas.edu', password: 'longenough' })).rejects.toThrow(
      'already exists'
    );
  });

  it('creates and signs in a new UT account', async () => {
    const user = await signUp({ name: 'Sam Lee', email: 'Sam@UTexas.edu', password: 'longenough' });
    expect(user.email).toBe('sam@utexas.edu');
    expect(user.joinedAt).toBeTruthy();
    expect(getSessionSnapshot()?.id).toBe(user.id);
  });
});

describe('updateProfile', () => {
  it('updates name and bio for the signed-in user and the session', async () => {
    await signIn('alex@utexas.edu', 'password');
    await updateProfile({ name: '  Alex K.  ', bio: '  Lends blazers.  ' });
    expect(getSessionSnapshot()).toMatchObject({ name: 'Alex K.', bio: 'Lends blazers.' });
    expect(getUserSnapshot('u1')).toMatchObject({ name: 'Alex K.', bio: 'Lends blazers.' });
  });

  it('clears an empty bio, and rejects an empty name or a long bio', async () => {
    await signIn('alex@utexas.edu', 'password');
    await updateProfile({ name: 'Alex', bio: '   ' });
    expect(getSessionSnapshot()?.bio).toBeUndefined();
    await expect(updateProfile({ name: '  ', bio: '' })).rejects.toThrow('name');
    await expect(updateProfile({ name: 'Alex', bio: 'x'.repeat(161) })).rejects.toThrow('160');
  });

  it('requires being signed in', async () => {
    await expect(updateProfile({ name: 'Nobody', bio: '' })).rejects.toThrow('Not signed in');
  });
});

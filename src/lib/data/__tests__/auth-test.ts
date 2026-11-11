import { supabase } from '../../supabase';
import {
  getSessionSnapshot,
  isUtexasEmail,
  signIn,
  signOut,
  signUp,
  updateProfile,
  UTEXAS_EMAIL_ERROR,
} from '../auth';
import type { ProfileRow } from '../rows';
import { getUserSnapshot } from '../users';

jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(async () => ({ error: null })),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const ALEX: ProfileRow = {
  id: 'u1',
  name: 'Alex Kim',
  bio: '',
  avatar_url: null,
  role: null,
  created_at: '2026-08-20T00:00:00Z',
};

// Stand-in for loading from Supabase: the signed-in user's profile is all these tests need.
jest.mock('../sync', () => ({
  loadAppData: jest.fn(async (userId: string, email: string) => {
    const { setUsers } = jest.requireActual('../users');
    const { toUser } = jest.requireActual('../rows');
    setUsers([toUser({ ...ALEX, id: userId }, email)]);
  }),
  clearAppData: jest.fn(),
  startLiveUpdates: jest.fn(),
}));

const auth = jest.mocked(supabase.auth);
const authUser = (email: string) => ({ id: 'u1', email });

/** Makes supabase.from('profiles').update().eq().select().single() resolve to `row`. */
function mockProfileUpdate(row: Partial<ProfileRow>) {
  const chain: Record<string, jest.Mock> = {
    eq: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn(async () => ({ data: { ...ALEX, ...row }, error: null })),
  };
  chain.update = jest.fn(() => chain);
  jest.mocked(supabase.from).mockReturnValue(chain as never);
  return chain.update;
}

async function signInAsAlex() {
  auth.signInWithPassword.mockResolvedValueOnce({ data: { user: authUser('alex@utexas.edu') }, error: null } as never);
  await signIn('alex@utexas.edu', 'password');
}

afterEach(async () => {
  await signOut();
  jest.clearAllMocks();
});

describe('isUtexasEmail', () => {
  it.each([
    'alex@utexas.edu',
    'ALEX@UTEXAS.EDU',
    '  alex@utexas.edu  ',
    'alex@my.utexas.edu',
    'abc123@eid.utexas.edu',
    'alex@cs.utexas.edu',
    'alex@mail.cs.utexas.edu',
  ])('accepts %s', (email) => {
    expect(isUtexasEmail(email)).toBe(true);
  });

  it.each([
    'alex@gmail.com',
    'alex@utexas.edu.evil.com',
    'alex@fakeutexas.edu',
    'alex@utexas.edu.com',
    'alex@my_utexas.edu',
    'alex@.utexas.edu',
    '@utexas.edu',
    'utexas.edu',
    '',
  ])('rejects %s', (email) => {
    expect(isUtexasEmail(email)).toBe(false);
  });
});

describe('signIn', () => {
  it('rejects non-UT emails without asking the server, and stays signed out', async () => {
    await expect(signIn('alex@gmail.com', 'password')).rejects.toThrow(UTEXAS_EMAIL_ERROR);
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
    expect(getSessionSnapshot()).toBeNull();
  });

  it('rejects a wrong password', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    } as never);
    await expect(signIn('alex@utexas.edu', 'wrong')).rejects.toThrow('Incorrect email or password.');
    expect(getSessionSnapshot()).toBeNull();
  });

  it('asks unconfirmed accounts to check their inbox', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'email_not_confirmed', message: 'Email not confirmed' },
    } as never);
    await expect(signIn('alex@utexas.edu', 'password')).rejects.toThrow('Confirm your email');
  });

  it('signs in a UT account regardless of email case', async () => {
    auth.signInWithPassword.mockResolvedValueOnce({ data: { user: authUser('alex@utexas.edu') }, error: null } as never);
    const user = await signIn('Alex@UTexas.edu', 'password');
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'alex@utexas.edu', password: 'password' });
    expect(user.id).toBe('u1');
    expect(getSessionSnapshot()?.email).toBe('alex@utexas.edu');
  });
});

describe('signUp', () => {
  it('rejects non-UT emails', async () => {
    await expect(signUp({ name: 'Sam', email: 'sam@gmail.com', password: 'longenough' })).rejects.toThrow(
      UTEXAS_EMAIL_ERROR
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('rejects short passwords', async () => {
    await expect(signUp({ name: 'Sam', email: 'sam@utexas.edu', password: 'short' })).rejects.toThrow(
      'at least 8 characters'
    );
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('rejects an email that already has an account', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { code: 'user_already_exists', message: 'User already registered' },
    } as never);
    await expect(signUp({ name: 'Alex', email: 'alex@utexas.edu', password: 'longenough' })).rejects.toThrow(
      'already exists'
    );
  });

  it('asks new accounts to confirm their email when there is no session yet', async () => {
    auth.signUp.mockResolvedValueOnce({ data: { user: authUser('sam@utexas.edu'), session: null }, error: null } as never);
    await expect(signUp({ name: 'Sam', email: 'Sam@UTexas.edu', password: 'longenough' })).rejects.toThrow(
      'sam@utexas.edu'
    );
    expect(getSessionSnapshot()).toBeNull();
  });

  it('creates and signs in a new UT account, saving the name', async () => {
    auth.signUp.mockResolvedValueOnce({
      data: { user: authUser('sam@utexas.edu'), session: {} },
      error: null,
    } as never);
    const user = await signUp({ name: '  Sam Lee ', email: 'Sam@UTexas.edu', password: 'longenough' });
    expect(auth.signUp).toHaveBeenCalledWith({
      email: 'sam@utexas.edu',
      password: 'longenough',
      options: { data: { name: 'Sam Lee' } },
    });
    expect(user.email).toBe('sam@utexas.edu');
    expect(getSessionSnapshot()?.id).toBe(user.id);
  });
});

describe('updateProfile', () => {
  it('saves trimmed name and bio, and updates the session and users', async () => {
    await signInAsAlex();
    const update = mockProfileUpdate({ name: 'Alex K.', bio: 'Lends blazers.' });
    await updateProfile({ name: '  Alex K.  ', bio: '  Lends blazers.  ' });
    expect(update).toHaveBeenCalledWith({ name: 'Alex K.', bio: 'Lends blazers.' });
    expect(getSessionSnapshot()).toMatchObject({ name: 'Alex K.', bio: 'Lends blazers.', email: 'alex@utexas.edu' });
    expect(getUserSnapshot('u1')).toMatchObject({ name: 'Alex K.', bio: 'Lends blazers.' });
  });

  it('clears an empty bio, and rejects an empty name or a long bio', async () => {
    await signInAsAlex();
    mockProfileUpdate({ name: 'Alex', bio: '' });
    await updateProfile({ name: 'Alex', bio: '   ' });
    expect(getSessionSnapshot()?.bio).toBeUndefined();
    await expect(updateProfile({ name: '  ', bio: '' })).rejects.toThrow('name');
    await expect(updateProfile({ name: 'Alex', bio: 'x'.repeat(161) })).rejects.toThrow('160');
  });

  it('requires being signed in', async () => {
    await expect(updateProfile({ name: 'Nobody', bio: '' })).rejects.toThrow('Not signed in');
  });
});

import { useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { AuthError, MIN_PASSWORD_LENGTH, resetPassword, sendPasswordReset } from '@/lib/data/auth';

/** Supabase only sends one reset email per address per minute. */
const RESEND_SECONDS = 60;

/** Email a reset code, then enter it with a new password. */
export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentAt, setSentAt] = useState(0);
  const [resent, setResent] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, RESEND_SECONDS - Math.floor((now - sentAt) / 1000));

  // Tick once a second while the resend button is counting down.
  useEffect(() => {
    if (!codeSent || secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [codeSent, secondsLeft]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    setSubmitting(true);
    try {
      await action();
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!codeSent) {
    return (
      <AuthForm
        error={error}
        submitTitle="Email me a code"
        canSubmit={email.length > 0 && !submitting}
        onSubmit={() =>
          run(async () => {
            await sendPasswordReset(email);
            setSentAt(Date.now());
            setNow(Date.now());
            setResent(false);
            setCodeSent(true);
          })
        }>
        <ThemedText themeColor="textSecondary">
          Enter your UT email and we’ll send you a code to set a new password.
        </ThemedText>
        <TextField
          label="UT email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@utexas.edu"
          variant="contrast"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
      </AuthForm>
    );
  }

  return (
    <AuthForm
      error={error}
      submitTitle="Set new password"
      canSubmit={code.trim().length > 0 && password.length > 0 && !submitting}
      // On success the auth guard in the root layout switches to the app.
      onSubmit={() => run(() => resetPassword({ email, code, password }))}
      secondaryTitle={secondaryLabel(secondsLeft)}
      secondaryDisabled={secondsLeft > 0 || submitting}
      onSecondary={() =>
        run(async () => {
          await sendPasswordReset(email);
          setSentAt(Date.now());
          setNow(Date.now());
          setResent(true);
        })
      }
      footer={
        <Pressable
          onPress={() => {
            setCodeSent(false);
            setCode('');
            setError(null);
          }}
          accessibilityRole="button"
          hitSlop={8}>
          <ThemedText type="small" themeColor="accent">
            Use a different email
          </ThemedText>
        </Pressable>
      }>
      <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
        {resent ? 'New code sent' : 'We sent a code'} to {email.trim()}. It can take a minute or two, so check your junk
        folder too. Only the newest code works.
      </ThemedText>
      <TextField
        label="Code"
        value={code}
        onChangeText={setCode}
        variant="contrast"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        variant="contrast"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
    </AuthForm>
  );
}

function secondaryLabel(secondsLeft: number) {
  if (secondsLeft === 0) return 'Send a new code';
  return `Send a new code in 0:${String(secondsLeft).padStart(2, '0')}`;
}

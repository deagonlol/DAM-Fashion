import { useState } from 'react';

import { AuthForm } from '@/components/auth-form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { AuthError, signIn } from '@/lib/data/auth';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // On success the auth guard in the root layout switches to the app.
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthForm
      error={error}
      submitTitle="Log in"
      canSubmit={email.length > 0 && password.length > 0 && !submitting}
      onSubmit={handleSubmit}
      footer={
        <ThemedText type="small" themeColor="textSecondary">
          Test account: alex@utexas.edu / password
        </ThemedText>
      }>
      <TextField
        label="UT email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@utexas.edu"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />
    </AuthForm>
  );
}

import { useState } from 'react';

import { AuthForm } from '@/components/auth-form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { AuthError, MIN_PASSWORD_LENGTH, signUp } from '@/lib/data/auth';

export default function SignUpScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // On success the auth guard in the root layout switches to the app.
      await signUp({ name, email, password });
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthForm
      error={error}
      submitTitle="Create account"
      canSubmit={name.trim().length > 0 && email.length > 0 && password.length > 0 && !submitting}
      onSubmit={handleSubmit}
      footer={
        <ThemedText type="small" themeColor="textSecondary">
          Only @utexas.edu emails can sign up for now.
        </ThemedText>
      }>
      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="First and last name"
        variant="contrast"
        autoComplete="name"
        textContentType="name"
      />
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
      <TextField
        label="Password"
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

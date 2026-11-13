import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthError, ConfirmEmailError, MIN_PASSWORD_LENGTH, signUp } from '@/lib/data/auth';

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
      setSubmitting(false);
      // The account exists; the next step is the code from the confirmation email.
      if (e instanceof ConfirmEmailError) {
        router.push({ pathname: '/confirm-email', params: { email: email.trim(), sentAt: String(Date.now()) } });
        return;
      }
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
    }
  }

  return (
    <AuthForm
      error={error}
      submitTitle="Create account"
      canSubmit={name.trim().length > 0 && email.length > 0 && password.length > 0 && !submitting}
      onSubmit={handleSubmit}
      footer={
        <View style={styles.footer}>
          <ThemedText type="small" themeColor="textSecondary">
            Use your UT email: utexas.edu, my.utexas.edu, eid.utexas.edu, and other UT addresses all work. By creating
            an account, you agree to the{' '}
            <Link href="/legal/terms">
              <ThemedText type="smallBold" themeColor="accent">
                Terms of Service
              </ThemedText>
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy">
              <ThemedText type="smallBold" themeColor="accent">
                Privacy Policy
              </ThemedText>
            </Link>
            .{'\n\n'}Already have an account?{' '}
            <Link href="/sign-in" dismissTo>
              <ThemedText type="smallBold" themeColor="accent">
                Log in
              </ThemedText>
            </Link>
          </ThemedText>
        </View>
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

const styles = StyleSheet.create({
  footer: {
    gap: Spacing.three,
  },
});

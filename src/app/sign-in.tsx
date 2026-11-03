import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthError, signIn } from '@/lib/data/auth';

const TEST_EMAIL = 'alex.damtest@utexas.edu';
const TEST_PASSWORD = 'damfashion';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function enter(nextEmail: string, nextPassword: string) {
    setError(null);
    setSubmitting(true);
    try {
      // On success the auth guard in the root layout switches to the app.
      await signIn(nextEmail, nextPassword);
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
      onSubmit={() => enter(email, password)}
      secondaryTitle="Skip login"
      onSecondary={() => enter(TEST_EMAIL, TEST_PASSWORD)}
      secondaryDisabled={submitting}
      footer={
        <View style={styles.footer}>
          <Link href="/forgot-password">
            <ThemedText type="small" themeColor="accent">
              Forgot password?
            </ThemedText>
          </Link>
          <ThemedText type="small" themeColor="textSecondary">
            Test account: {TEST_EMAIL} / {TEST_PASSWORD}
          </ThemedText>
        </View>
      }>
      <TextField
        label="UT email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@utexas.edu"
        autoCapitalize="none"
        variant="contrast"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        variant="contrast"
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => enter(email, password)}
      />
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: Spacing.three,
  },
});

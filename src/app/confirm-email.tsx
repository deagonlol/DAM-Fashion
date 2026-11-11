import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { ResendConfirmation } from '@/components/resend-confirmation';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthError, confirmSignUp } from '@/lib/data/auth';

/**
 * Enter the 6-digit code from the sign-up email. Codes instead of links, because UT's mail
 * filter treats emails with sign-in links from a new sender as phishing.
 * `sentAt` (ms) is when the last code went out, so the resend countdown picks up from there.
 */
export default function ConfirmEmailScreen() {
  const params = useLocalSearchParams<{ email?: string; sentAt?: string }>();
  const email = params.email ?? '';
  const [sentAt] = useState(() => Number(params.sentAt) || 0);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      // On success the auth guard in the root layout switches to the app.
      await confirmSignUp(email, code);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : 'Something went wrong. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <AuthForm
      error={error}
      submitTitle="Confirm email"
      canSubmit={code.trim().length >= 6 && email.length > 0 && !submitting}
      onSubmit={handleSubmit}
      footer={
        <View style={styles.footer}>
          <ResendConfirmation email={email} sentAt={sentAt} />
          <Pressable onPress={() => router.replace('/sign-up')} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Wrong email? Sign up again
            </ThemedText>
          </Pressable>
        </View>
      }>
      <ThemedText themeColor="textSecondary" accessibilityLiveRegion="polite">
        We sent a 6-digit code to {email}. It can take a minute or two, so check your junk folder too. Only the newest
        code works.
      </ThemedText>
      <TextField
        label="Code"
        value={code}
        onChangeText={setCode}
        variant="contrast"
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={10}
        autoFocus
        onSubmitEditing={handleSubmit}
      />
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  footer: {
    gap: Spacing.three,
  },
});

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthError, resendConfirmation } from '@/lib/data/auth';

/** Supabase only sends one confirmation email per address per minute. */
const RESEND_SECONDS = 60;

/**
 * "Send a new code" for someone who signed up but hasn't confirmed their email yet.
 * Counts down from the last send so taps don't hit Supabase's one-a-minute limit.
 */
export function ResendConfirmation({ email, sentAt }: { email: string; sentAt: number }) {
  const [lastSent, setLastSent] = useState(sentAt);
  const [now, setNow] = useState(() => Date.now());
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const secondsLeft = Math.max(0, RESEND_SECONDS - Math.floor((now - lastSent) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function resend() {
    setSending(true);
    setStatus(null);
    try {
      await resendConfirmation(email);
      setLastSent(Date.now());
      setNow(Date.now());
      setStatus(`New code sent to ${email.trim()}.`);
    } catch (e) {
      setStatus(e instanceof AuthError ? e.message : 'Couldn’t send the email. Try again.');
    } finally {
      setSending(false);
    }
  }

  const waiting = secondsLeft > 0;
  return (
    <View style={styles.container}>
      <Pressable
        onPress={resend}
        disabled={waiting || sending}
        accessibilityRole="button"
        accessibilityState={{ disabled: waiting || sending }}
        hitSlop={8}>
        <ThemedText type="smallBold" themeColor={waiting || sending ? 'textSecondary' : 'accent'}>
          {waiting ? `Send a new code in 0:${String(secondsLeft).padStart(2, '0')}` : 'Send a new code'}
        </ThemedText>
      </Pressable>
      {status ? (
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {status}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
});

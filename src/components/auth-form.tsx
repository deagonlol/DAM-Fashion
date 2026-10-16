import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type AuthFormProps = {
  children: ReactNode;
  error: string | null;
  submitTitle: string;
  canSubmit: boolean;
  onSubmit: () => void;
  footer?: ReactNode;
};

/** Shared layout for the sign-in and sign-up screens. */
export function AuthForm({ children, error, submitTitle, canSubmit, onSubmit, footer }: AuthFormProps) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic">
          {children}
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
          <Button title={submitTitle} onPress={onSubmit} disabled={!canSubmit} />
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
});

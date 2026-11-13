import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

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
  /** Extra button under submit. Not gated on canSubmit (used for skip-login). */
  secondaryTitle?: string;
  onSecondary?: () => void;
  secondaryDisabled?: boolean;
  footer?: ReactNode;
  /** Shown above the fields, e.g. the logo on the log in screen. */
  hero?: ReactNode;
};

/** Shared layout for the sign-in and sign-up screens. */
export function AuthForm({
  children,
  error,
  submitTitle,
  canSubmit,
  onSubmit,
  secondaryTitle,
  onSecondary,
  secondaryDisabled,
  footer,
  hero,
}: AuthFormProps) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="always"
          contentInsetAdjustmentBehavior="automatic">
          {hero}
          {children}
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
          <View style={styles.actions}>
            <Button title={submitTitle} onPress={onSubmit} disabled={!canSubmit} />
            {secondaryTitle && onSecondary ? (
              <Button title={secondaryTitle} variant="secondary" onPress={onSecondary} disabled={secondaryDisabled} />
            ) : null}
          </View>
          {footer ? <View>{footer}</View> : null}
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
  actions: {
    gap: Spacing.three,
  },
});

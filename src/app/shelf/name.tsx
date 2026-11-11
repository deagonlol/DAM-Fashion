import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useShelf } from '@/hooks/use-shelves';
import { useTheme } from '@/hooks/use-theme';
import { createShelf, renameShelf } from '@/lib/data/shelves';
import { MAX_SHELF_NAME_LENGTH } from '@/lib/data/types';

/**
 * Names a shelf. With `shelfId` it renames that shelf; otherwise it makes a new one, and puts
 * `listingId` on it when given (from "Add to shelf" on a listing).
 */
export default function ShelfNameScreen() {
  const { shelfId, listingId } = useLocalSearchParams<{ shelfId?: string; listingId?: string }>();
  const existing = useShelf(shelfId ?? '');
  const theme = useTheme();
  const [name, setName] = useState(existing?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const renaming = !!shelfId;

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      if (renaming) {
        await renameShelf(shelfId, name);
      } else {
        await createShelf(name, listingId);
      }
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: renaming ? 'Rename shelf' : 'New shelf' }} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label="Shelf name"
            value={name}
            onChangeText={setName}
            placeholder="Game day, formal, spring break…"
            maxLength={MAX_SHELF_NAME_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          {error ? (
            <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
              {error}
            </ThemedText>
          ) : null}
        </ScrollView>
        <SafeAreaView edges={['bottom']} style={[styles.footer, { borderColor: theme.border }]}>
          <Button
            title={renaming ? 'Save' : 'Create shelf'}
            onPress={handleSave}
            disabled={saving || name.trim().length === 0}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  footer: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

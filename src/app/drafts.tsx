import { router } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { DraftCard } from '@/components/draft-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-session';
import { useListingDrafts } from '@/lib/drafts';

/** Every listing you started and haven't posted, newest first. Saved on this phone. */
export default function DraftsScreen() {
  const user = useCurrentUser();
  const drafts = useListingDrafts(user.id);
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
        <ThemedText type="small" themeColor="textSecondary">
          Listings you started. They save on this phone as you go.
        </ThemedText>
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} />
        ))}
        {drafts.length === 0 ? <ThemedText themeColor="textSecondary">No drafts right now.</ThemedText> : null}
        <Button title="+ Start a new listing" variant="secondary" onPress={() => router.push('/list')} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
});

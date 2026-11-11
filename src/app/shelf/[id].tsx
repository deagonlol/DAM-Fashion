import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBrowseListings } from '@/hooks/use-browse';
import { useCurrentUser } from '@/hooks/use-session';
import { useShelf } from '@/hooks/use-shelves';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { addToShelf, deleteShelf, removeFromShelf, shelfSuggestions } from '@/lib/data/shelves';

const SUGGESTIONS_SHOWN = 6;

/** One shelf's pieces, with suggestions for more, plus rename, remove, and delete. */
export default function ShelfScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shelf = useShelf(id);
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewer = useCurrentUser();
  const browsable = useBrowseListings(EMPTY_FILTERS, 'Newest');
  const suggestions = useMemo(
    () =>
      shelf
        ? shelfSuggestions(
            shelf.listings,
            browsable.filter((listing) => listing.ownerId !== viewer.id),
            SUGGESTIONS_SHOWN
          )
        : [],
    [shelf, browsable, viewer.id]
  );

  if (!shelf) {
    return (
      <ThemedView style={[styles.container, styles.missing]}>
        <ThemedText themeColor="textSecondary">This shelf is gone.</ThemedText>
      </ThemedView>
    );
  }

  const count = shelf.listings.length;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    }
  }

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    await run(async () => {
      await deleteShelf(shelf!.id);
      router.back();
    });
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: shelf.name }} />
      <FlatList
        data={shelf.listings}
        keyExtractor={(listing) => listing.id}
        numColumns={2}
        renderItem={({ item }) => (
          <View style={styles.cell}>
            <ListingCard listing={item} />
            {editing ? (
              <Pressable
                onPress={() => run(() => removeFromShelf(shelf.id, item.id))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.title} from ${shelf.name}`}
                style={({ pressed }) => [styles.remove, { borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="smallBold" themeColor="danger">
                  Remove
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="small" themeColor="textSecondary">
              {count} {count === 1 ? 'piece' : 'pieces'}
            </ThemedText>
            <View style={styles.actions}>
              <Button
                title="Rename"
                variant="secondary"
                style={styles.flex}
                onPress={() =>
                  router.push({
                    pathname: '/shelf/name',
                    params: { shelfId: shelf.id },
                  })
                }
              />
              {count > 0 ? (
                <Button
                  title={editing ? 'Done' : 'Remove pieces'}
                  variant={editing ? 'primary' : 'secondary'}
                  style={styles.flex}
                  onPress={() => setEditing(!editing)}
                />
              ) : null}
            </View>
            {error ? (
              <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
                {error}
              </ThemedText>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing here yet. Open any listing and tap “Add to shelf”.
          </ThemedText>
        }
        ListFooterComponent={
          <View style={styles.footerStack}>
            {suggestions.length > 0 ? (
              <View style={styles.suggestions}>
                <View>
                  <ThemedText type="smallBold">More for this shelf</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Picked from what’s on it.
                  </ThemedText>
                </View>
                <View style={styles.grid}>
                  {suggestions.map((listing) => (
                    <View key={listing.id} style={styles.gridCell}>
                      <ListingCard listing={listing} />
                      <Button
                        title="+ Add"
                        variant="outline"
                        style={styles.add}
                        accessibilityLabel={`Add ${listing.title} to ${shelf.name}`}
                        onPress={() => run(() => addToShelf(shelf.id, listing.id))}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            <View style={[styles.footer, { borderColor: theme.border }]}>
              <Button
                title={confirmingDelete ? 'Tap again to delete this shelf' : 'Delete shelf'}
                variant="outline"
                onPress={handleDelete}
              />
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                The pieces stay in your closet and on any other shelves.
              </ThemedText>
            </View>
          </View>
        }
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  missing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  header: {
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  row: {
    gap: Spacing.three,
  },
  // Keeps a lone card in the last row at half width instead of stretching.
  cell: {
    flex: 1 / 2,
    gap: Spacing.two,
  },
  remove: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
  footerStack: {
    gap: Spacing.four,
  },
  suggestions: {
    gap: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  // Two per row: half the width, minus half the gap between them.
  gridCell: {
    width: '47%',
    flexGrow: 1,
    maxWidth: '50%',
    gap: Spacing.two,
  },
  add: {
    paddingVertical: Spacing.two,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  center: {
    textAlign: 'center',
  },
});

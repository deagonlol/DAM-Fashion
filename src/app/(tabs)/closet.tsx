import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { ListingGrid } from '@/components/listing-grid';
import { ProfileButton } from '@/components/profile-button';
import { ShelfCard } from '@/components/shelf-card';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';
import { useShelves } from '@/hooks/use-shelves';
import { listingMentions } from '@/lib/data/listings';

const VIEWS = ['Pieces', 'Shelves'] as const;
type ClosetView = (typeof VIEWS)[number];

/** Your closet: pieces you saved, and shelves that group pieces into looks. */
export default function ClosetScreen() {
  const user = useCurrentUser();
  const saved = useSavedListings(user.id);
  const shelves = useShelves();
  const [view, setView] = useState<ClosetView>('Pieces');
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const shownPieces = useMemo(
    () => (searching ? saved.filter((listing) => listingMentions(listing, query)) : saved),
    [saved, query, searching]
  );
  // A shelf matches on its own name or on any piece on it.
  const shownShelves = useMemo(
    () =>
      searching
        ? shelves.filter(
            (shelf) =>
              shelf.name.toLowerCase().includes(query.trim().toLowerCase()) ||
              shelf.listings.some((listing) => listingMentions(listing, query))
          )
        : shelves,
    [shelves, query, searching]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" themeColor="accent">
            My Closet
          </ThemedText>
          <ProfileButton />
        </View>
        <View style={styles.controls}>
          <TextField
            variant="search"
            value={query}
            onChangeText={setQuery}
            placeholder={view === 'Pieces' ? 'Search your closet…' : 'Search your shelves…'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <ChipGroup variant="segment" options={VIEWS} value={view} onChange={(next) => next && setView(next)} />
        </View>
        {view === 'Pieces' ? (
          <ListingGrid
            listings={shownPieces}
            emptyText={searching ? 'Nothing in your closet matches.' : 'Tap the ♡ on any item to save it here.'}
          />
        ) : (
          <FlatList
            data={shownShelves}
            keyExtractor={(shelf) => shelf.id}
            numColumns={2}
            renderItem={({ item }) => (
              <View style={styles.cell}>
                <ShelfCard shelf={item} />
              </View>
            )}
            ListHeaderComponent={
              <View style={styles.shelvesHeader}>
                <Button
                  title="+ New Shelf"
                  onPress={() => router.push('/shelf/name')}
                  style={styles.newShelf}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  Group pieces into looks for an event. Discover, plan, and build your next look, all in one place.
                </ThemedText>
              </View>
            }
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                {searching ? 'No shelves match.' : 'No shelves yet. Make one, then add pieces from any listing.'}
              </ThemedText>
            }
            columnWrapperStyle={styles.row}
            contentContainerStyle={styles.list}
            contentInsetAdjustmentBehavior="automatic"
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  controls: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  shelvesHeader: {
    gap: Spacing.two,
  },
  newShelf: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.two,
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  row: {
    gap: Spacing.three,
  },
  // Keeps a lone shelf in the last row at half width instead of stretching.
  cell: {
    flex: 1 / 2,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});

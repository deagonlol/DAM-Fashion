import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { DraftList } from '@/components/draft-card';
import { ListingGrid } from '@/components/listing-grid';
import { SearchBar } from '@/components/search-bar';
import { ShelfCard } from '@/components/shelf-card';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListingsByOwner } from '@/hooks/use-listings';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';
import { useShelves, type ShelfWithListings } from '@/hooks/use-shelves';
import { listingMentions } from '@/lib/data/listings';

const VIEWS = ['Rack', 'Shelves'] as const;
const ALL_SAVED_ID = 'all-saved';
type ClosetView = (typeof VIEWS)[number];

/**
 * Your closet. "Rack" is what you lend, hanging up for others to borrow (plus drafts). "Shelves"
 * is what you collect: an "All saved" shelf of everything you hearted, then the shelves you make.
 */
export default function ClosetScreen() {
  const user = useCurrentUser();
  const saved = useSavedListings(user.id);
  const mine = useListingsByOwner(user.id);
  const shelves = useShelves();
  // Every hearted piece, shown as the first board like Pinterest's "All pins".
  const allSaved: ShelfWithListings = useMemo(
    () => ({ id: ALL_SAVED_ID, ownerId: user.id, name: 'All saved', listingIds: [], createdAt: '', listings: saved }),
    [user.id, saved]
  );
  const [view, setView] = useState<ClosetView>('Rack');
  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const shownPieces = useMemo(
    () => (searching ? saved.filter((listing) => listingMentions(listing, query)) : saved),
    [saved, query, searching]
  );
  const shownMine = useMemo(
    () => (searching ? mine.filter((listing) => listingMentions(listing, query)) : mine),
    [mine, query, searching]
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="My Closet">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={view === 'Shelves' ? 'Search your shelves…' : 'Search your rack…'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <ChipGroup variant="segment" options={VIEWS} value={view} onChange={(next) => next && setView(next)} />
        </TabHeader>
        {view === 'Rack' ? (
          <ListingGrid
            listings={shownMine}
            header={
              <View style={styles.mineHeader}>
                <ThemedText type="small" themeColor="textSecondary">
                  What you’re lending out. Others can borrow anything on your rack.
                </ThemedText>
                <Button title="+ List an item" onPress={() => router.push('/list')} />
                <DraftList />
              </View>
            }
            emptyText={
              searching ? 'Nothing on your rack matches.' : 'Your rack is empty. Hang something up to start earning.'
            }
          />
        ) : searching ? (
          // Searching Shelves looks through every saved piece, not the shelves themselves.
          <ListingGrid listings={shownPieces} emptyText="Nothing on your shelves matches." />
        ) : (
          <FlatList
            data={[allSaved, ...shelves]}
            keyExtractor={(shelf) => shelf.id}
            numColumns={2}
            renderItem={({ item }) => (
              <View style={styles.cell}>
                <ShelfCard shelf={item} href={item.id === ALL_SAVED_ID ? '/saved' : undefined} />
              </View>
            )}
            ListHeaderComponent={
              <View style={styles.shelvesHeader}>
                <Button title="+ New shelf" onPress={() => router.push('/shelf/name')} style={styles.newShelf} />
                <ThemedText type="small" themeColor="textSecondary">
                  Everything you heart lands on All saved. Make more shelves to group pieces into looks for an event.
                </ThemedText>
              </View>
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
  mineHeader: {
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
});

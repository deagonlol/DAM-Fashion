import type { ReactElement } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ListingCard } from '@/components/listing-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import type { Listing } from '@/lib/data/types';

type ListingGridProps = {
  listings: Listing[];
  header?: ReactElement;
  emptyText?: string;
};

export function ListingGrid({ listings, header, emptyText = 'No listings yet.' }: ListingGridProps) {
  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <ListingCard listing={item} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <ThemedText themeColor="textSecondary" style={styles.empty}>
          {emptyText}
        </ThemedText>
      }
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  row: {
    gap: Spacing.three,
  },
  // Keeps a lone card in the last row at half width instead of stretching.
  cell: {
    flex: 1 / 2,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});

import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { FilterPanel, FilterToggle } from '@/components/filter-dropdown';
import { ListingGrid } from '@/components/listing-grid';
import { ProfileButton } from '@/components/profile-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { Spacing } from '@/constants/theme';
import { useBrowseListings, useBrowsePeople } from '@/hooks/use-browse';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import {
  CATEGORIES,
  EVENTS,
  SIZES,
  SORT_OPTIONS,
  type ListingFilters,
  type ListingSort,
} from '@/lib/data/types';

const MODES = ['Items', 'People'] as const;
type Mode = (typeof MODES)[number];

const PRICE_LIMITS = [5, 10, 20] as const;
const PRICE_LABELS = PRICE_LIMITS.map((price) => `Up to $${price}/day`);

type Panel = 'type' | 'event' | 'size' | 'price' | 'sort';

/** Home: the listing feed, with search, filters, and sort applied in place. */
export default function HomeScreen() {
  const [mode, setMode] = useState<Mode>('Items');
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<ListingSort>('Newest');
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const results = useBrowseListings(filters, sort);
  const people = useBrowsePeople(filters.query);

  const filterCount =
    filters.categories.length + filters.events.length + filters.sizes.length + (filters.maxPrice !== null ? 1 : 0);
  const count = mode === 'Items' ? results.length : people.length;
  const countLabel =
    mode === 'Items' ? `${count} ${count === 1 ? 'result' : 'results'}` : `${count} ${count === 1 ? 'person' : 'people'}`;

  function update(patch: Partial<ListingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function toggle(panel: Panel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  const priceLabel = filters.maxPrice !== null ? `Up to $${filters.maxPrice}/day` : null;

  function renderPanel() {
    switch (openPanel) {
      case 'type':
        return (
          <FilterPanel onClear={() => update({ categories: [] })} onDone={() => setOpenPanel(null)}>
            <MultiChipGroup
              options={CATEGORIES}
              values={filters.categories}
              onChange={(categories) => update({ categories })}
            />
          </FilterPanel>
        );
      case 'event':
        return (
          <FilterPanel onClear={() => update({ events: [] })} onDone={() => setOpenPanel(null)}>
            <MultiChipGroup options={EVENTS} values={filters.events} onChange={(events) => update({ events })} />
          </FilterPanel>
        );
      case 'size':
        return (
          <FilterPanel onClear={() => update({ sizes: [] })} onDone={() => setOpenPanel(null)}>
            <MultiChipGroup options={SIZES} values={filters.sizes} onChange={(sizes) => update({ sizes })} />
          </FilterPanel>
        );
      case 'price':
        return (
          <FilterPanel onClear={() => update({ maxPrice: null })} onDone={() => setOpenPanel(null)}>
            <ChipGroup
              options={PRICE_LABELS}
              value={priceLabel}
              allowDeselect
              onChange={(label) =>
                update({ maxPrice: label ? PRICE_LIMITS[PRICE_LABELS.indexOf(label)] : null })
              }
            />
          </FilterPanel>
        );
      case 'sort':
        return (
          <FilterPanel onClear={() => setSort('Newest')} onDone={() => setOpenPanel(null)}>
            <ChipGroup options={SORT_OPTIONS} value={sort} onChange={(next) => next && setSort(next)} />
          </FilterPanel>
        );
      default:
        return null;
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" themeColor="accent">
              DAM Fashion
            </ThemedText>
            <View style={styles.titleActions}>
              <ChipGroup options={MODES} value={mode} onChange={(next) => next && setMode(next)} />
              <ProfileButton />
            </View>
          </View>
          <TextField
            variant="search"
            value={filters.query}
            onChangeText={(query) => update({ query })}
            placeholder={mode === 'Items' ? 'Search for outfits, clubs, or events...' : 'Search people by name'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          {mode === 'Items' ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <FilterToggle
                  label="Type"
                  count={filters.categories.length}
                  open={openPanel === 'type'}
                  onPress={() => toggle('type')}
                />
                <FilterToggle
                  label="Event"
                  count={filters.events.length}
                  open={openPanel === 'event'}
                  onPress={() => toggle('event')}
                />
                <FilterToggle
                  label="Size"
                  count={filters.sizes.length}
                  open={openPanel === 'size'}
                  onPress={() => toggle('size')}
                />
                <FilterToggle
                  label={priceLabel ?? 'Price'}
                  count={0}
                  open={openPanel === 'price'}
                  onPress={() => toggle('price')}
                />
                <FilterToggle
                  label={`Sort: ${sort}`}
                  count={0}
                  open={openPanel === 'sort'}
                  onPress={() => toggle('sort')}
                />
              </ScrollView>
              {renderPanel()}
            </>
          ) : null}
          <View style={styles.summary}>
            <ThemedText type="small" themeColor="textSecondary">
              {countLabel}
            </ThemedText>
            {mode === 'Items' && filterCount > 0 ? (
              <Pressable
                onPress={() => setFilters((current) => ({ ...EMPTY_FILTERS, query: current.query }))}
                accessibilityRole="button"
                hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Clear all filters
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        </View>

        {mode === 'Items' ? (
          <ListingGrid listings={results} emptyText="No items match your search." />
        ) : (
          <FlatList
            data={people}
            keyExtractor={(user) => user.id}
            renderItem={({ item }) => <UserRow user={item} />}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.empty}>
                No one by that name.
              </ThemedText>
            }
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  chips: {
    gap: Spacing.two,
  },
  summary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
});

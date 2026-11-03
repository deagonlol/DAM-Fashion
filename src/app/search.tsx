import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip, ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { FilterPanel, FilterToggle } from '@/components/filter-dropdown';
import { ListingGrid } from '@/components/listing-grid';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { Spacing } from '@/constants/theme';
import { useBrowseListings, useBrowsePeople } from '@/hooks/use-browse';
import { useRentals } from '@/hooks/use-rentals';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { isAvailableOn, toDateString } from '@/lib/data/rentals';
import { describeIntent, parseSearchQuery, type SearchIntent } from '@/lib/data/search';
import {
  CATEGORIES,
  EVENTS,
  SIZES,
  SORT_OPTIONS,
  type ListingFilters,
  type ListingSort,
} from '@/lib/data/types';
import { describePhoto } from '@/lib/data/vision-search';
import { formatPrice } from '@/lib/format';

const MODES = ['Items', 'People'] as const;
type Mode = (typeof MODES)[number];

const PRICE_LIMITS = [5, 10, 20] as const;
const PRICE_LABELS = PRICE_LIMITS.map((price) => `Up to $${price}/day`);

type Panel = 'type' | 'event' | 'size' | 'price' | 'sort';

type Params = {
  /** A typed search from Home. */
  q?: string;
  /** An event tile from Home. */
  event?: string;
  /** A clothing type chip from Home's Trending row. */
  category?: string;
  sort?: string;
};

/** The filters a search starts with, from whatever Home passed in. */
function initialFilters({ q, event, category }: Params): ListingFilters {
  if (q) {
    const intent = parseSearchQuery(q);
    return {
      query: q,
      words: intent.words,
      interpreted: true,
      categories: intent.categories,
      events: intent.events,
      sizes: intent.sizes,
      maxPrice: intent.maxPrice,
    };
  }
  const events = EVENTS.filter((tag) => tag === event);
  const categories = CATEGORIES.filter((type) => type === category);
  return { ...EMPTY_FILTERS, events, categories };
}

/** Search results: the full listing grid with smart search, photo search, filters, and sort. */
export default function SearchScreen() {
  const params = useLocalSearchParams<Params>();
  const [mode, setMode] = useState<Mode>('Items');
  const [filters, setFilters] = useState<ListingFilters>(() => initialFilters(params));
  const [sort, setSort] = useState<ListingSort>(
    () => SORT_OPTIONS.find((option) => option === params.sort) ?? 'For you'
  );
  const [openPanel, setOpenPanel] = useState<Panel | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [availableToday, setAvailableToday] = useState(false);
  const rentals = useRentals();
  const matching = useBrowseListings(filters, sort);
  const results = useMemo(() => {
    if (!availableToday) return matching;
    const today = toDateString(new Date());
    return matching.filter((listing) => isAvailableOn(rentals, listing, today));
  }, [matching, availableToday, rentals]);
  const people = useBrowsePeople(filters.query);

  const filterCount =
    filters.categories.length + filters.events.length + filters.sizes.length + (filters.maxPrice !== null ? 1 : 0);
  const count = mode === 'Items' ? results.length : people.length;
  const countLabel =
    mode === 'Items' ? `${count} ${count === 1 ? 'result' : 'results'}` : `${count} ${count === 1 ? 'person' : 'people'}`;

  function update(patch: Partial<ListingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function applyIntent(intent: SearchIntent, query: string) {
    setPhotoMessage(null);
    setFilters({
      query,
      words: intent.words,
      interpreted: true,
      categories: intent.categories,
      events: intent.events,
      sizes: intent.sizes,
      maxPrice: intent.maxPrice,
    });
  }

  const understood = [
    ...filters.events,
    ...filters.categories,
    ...filters.sizes,
    filters.maxPrice !== null ? `under ${formatPrice(filters.maxPrice)}` : null,
    ...filters.words,
  ].filter((part): part is string => part !== null);
  const showUnderstood =
    filters.interpreted &&
    (filters.categories.length > 0 ||
      filters.events.length > 0 ||
      filters.sizes.length > 0 ||
      filters.maxPrice !== null);

  async function searchByPhoto(source: 'library' | 'camera') {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.4, base64: true };
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setPhotoMessage('Allow camera access in Settings to search with a photo.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets) return;
    const asset = result.assets[0];
    if (!asset?.base64) {
      setPhotoMessage('Could not read that photo.');
      return;
    }
    setPhotoBusy(true);
    setPhotoMessage(null);
    try {
      const intent = await describePhoto(asset.base64, asset.mimeType ?? 'image/jpeg');
      applyIntent(intent, describeIntent(intent));
    } catch (e) {
      setPhotoMessage(e instanceof Error ? e.message : 'Photo search failed.');
    } finally {
      setPhotoBusy(false);
    }
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
          <FilterPanel onClear={() => setSort('For you')} onDone={() => setOpenPanel(null)}>
            <ChipGroup options={SORT_OPTIONS} value={sort} onChange={(next) => next && setSort(next)} />
          </FilterPanel>
        );
      default:
        return null;
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <ChipGroup options={MODES} value={mode} onChange={(next) => next && setMode(next)} />
          <TextField
            variant="search"
            value={filters.query}
            onChangeText={(query) => (mode === 'Items' ? applyIntent(parseSearchQuery(query), query) : update({ query }))}
            placeholder={mode === 'Items' ? 'Try “black formal dress under $15”' : 'Search people by name'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoFocus={!params.q && !params.event && !params.category && !params.sort}
          />
          {mode === 'Items' ? (
            photoBusy ? (
              <ThemedText type="small" themeColor="textSecondary">
                Reading photo…
              </ThemedText>
            ) : (
              <View style={styles.photoActions}>
                <Pressable onPress={() => searchByPhoto('camera')} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    Take a photo
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => searchByPhoto('library')} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    Search by photo
                  </ThemedText>
                </Pressable>
              </View>
            )
          ) : null}
          {photoMessage ? (
            <ThemedText type="small" themeColor="danger">
              {photoMessage}
            </ThemedText>
          ) : null}
          {mode === 'Items' && showUnderstood ? (
            <ThemedText type="small" themeColor="textSecondary">
              Looking for {understood.join(' · ')}
            </ThemedText>
          ) : null}
          {mode === 'Items' ? (
            <>
              <View style={styles.quick}>
                <Chip
                  label="All"
                  selected={!availableToday && filters.events.length === 0}
                  onPress={() => {
                    setAvailableToday(false);
                    update({ events: [] });
                    setOpenPanel(null);
                  }}
                />
                <Chip
                  label="Available today"
                  selected={availableToday}
                  accessibilityRole="checkbox"
                  onPress={() => setAvailableToday((on) => !on)}
                />
                <Chip
                  label={filters.events.length > 0 ? `For ${filters.events.join(', ')}` : 'For events ▾'}
                  selected={filters.events.length > 0}
                  onPress={() => toggle('event')}
                />
              </View>
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
            {mode === 'Items' && (filterCount > 0 || availableToday) ? (
              <Pressable
                onPress={() => {
                  setFilters(EMPTY_FILTERS);
                  setAvailableToday(false);
                  setPhotoMessage(null);
                }}
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
      </View>
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
  chips: {
    gap: Spacing.two,
  },
  quick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  photoActions: {
    flexDirection: 'row',
    gap: Spacing.four,
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

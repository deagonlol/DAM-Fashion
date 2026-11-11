import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Chip, ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { FilterPanel, FilterToggle } from '@/components/filter-dropdown';
import { ListingGrid } from '@/components/listing-grid';
import { SearchBar, SearchBarButton } from '@/components/search-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { UserRow } from '@/components/user-row';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBrowseListings, useBrowsePeople } from '@/hooks/use-browse';
import { useRentals } from '@/hooks/use-rentals';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { isAvailableOn, toDateString } from '@/lib/data/rentals';
import {
  findSimilarListings,
  preparePhoto,
  rankByMatches,
  warmUpImageSearch,
  type PhotoMatch,
} from '@/lib/data/image-search';
import { parseSearchQuery, type SearchIntent } from '@/lib/data/search';
import {
  CATEGORIES,
  EVENTS,
  SIZES,
  SORT_OPTIONS,
  type ListingFilters,
  type ListingSort,
} from '@/lib/data/types';
import { formatPrice } from '@/lib/format';

const MODES = ['Items', 'People'] as const;
type Mode = (typeof MODES)[number];

const PRICE_LIMITS = [5, 10, 20] as const;
const PRICE_LABELS = PRICE_LIMITS.map((price) => `Up to $${price}/day`);

/** 'photo' is the camera button's menu; the rest are filter dropdowns. */
type Panel = 'type' | 'event' | 'size' | 'price' | 'sort' | 'photo';

type Params = {
  /** A typed search from Home. */
  q?: string;
  /** An event tile from Home. */
  event?: string;
  /** A clothing type chip from Home's Trending row. */
  category?: string;
  sort?: string;
  /** Home's search bar buttons: open the photo menu or the filter row right away. */
  open?: string;
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
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('Items');
  const [filters, setFilters] = useState<ListingFilters>(() => initialFilters(params));
  const [sort, setSort] = useState<ListingSort>(
    () => SORT_OPTIONS.find((option) => option === params.sort) ?? 'For you'
  );
  const [openPanel, setOpenPanel] = useState<Panel | null>(() => (params.open === 'photo' ? 'photo' : null));
  /** The Type/Event/Size/Price/Sort row, behind the filters button. Open when Home passed filters in. */
  const [showFilters, setShowFilters] = useState(() =>
    Boolean(params.event || params.category || params.sort || params.open === 'filters')
  );
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  /** The photo being searched with and the listings that look like it, closest first. */
  const [photoSearch, setPhotoSearch] = useState<{ uri: string; matches: PhotoMatch[] } | null>(null);
  const [availableToday, setAvailableToday] = useState(false);
  const rentals = useRentals();
  const matching = useBrowseListings(filters, sort);
  const results = useMemo(() => {
    const ranked = photoSearch ? rankByMatches(matching, photoSearch.matches) : matching;
    if (!availableToday) return ranked;
    const today = toDateString(new Date());
    return ranked.filter((listing) => isAvailableOn(rentals, listing, today));
  }, [matching, photoSearch, availableToday, rentals]);

  // Wake the photo search service now so it's ready when someone picks a photo.
  useEffect(() => {
    warmUpImageSearch();
  }, []);
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
    setPhotoSearch(null);
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
    setOpenPanel(null);
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
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
    if (!asset?.uri) {
      setPhotoMessage('Could not read that photo.');
      return;
    }
    setPhotoBusy(true);
    setPhotoMessage(null);
    try {
      const matches = await findSimilarListings(await preparePhoto(asset.uri));
      setOpenPanel(null);
      // Typed words would hide visual matches whose titles don't mention them. Chips still narrow.
      update({ query: '', words: [], interpreted: false });
      setPhotoSearch({ uri: asset.uri, matches });
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
      case 'photo':
        return (
          <View style={[styles.photoMenu, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <ThemedText type="smallBold">Search with a photo</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              We’ll find listings that look like it.
            </ThemedText>
            <Pressable
              onPress={() => searchByPhoto('camera')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoOption, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                tintColor={theme.accent}
                size={20}
              />
              <ThemedText>Take a photo</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => searchByPhoto('library')}
              accessibilityRole="button"
              style={({ pressed }) => [styles.photoOption, pressed && styles.pressed]}>
              <SymbolView
                name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
                tintColor={theme.accent}
                size={20}
              />
              <ThemedText>Choose from library</ThemedText>
            </Pressable>
          </View>
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
          <SearchBar
            value={filters.query}
            onChangeText={(query) => (mode === 'Items' ? applyIntent(parseSearchQuery(query), query) : update({ query }))}
            placeholder={mode === 'Items' ? 'Try “black formal dress under $15”' : 'Search people by name'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoFocus={!params.q && !params.event && !params.category && !params.sort && !params.open}
            actions={
              mode === 'Items' ? (
                <>
                  <SearchBarButton
                    icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                    accessibilityLabel="Search with a photo"
                    active={openPanel === 'photo'}
                    busy={photoBusy}
                    onPress={() => toggle('photo')}
                  />
                  <SearchBarButton
                    icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                    accessibilityLabel={filterCount > 0 ? `Filters, ${filterCount} on` : 'Filters'}
                    active={showFilters}
                    onPress={() => {
                      setShowFilters((shown) => !shown);
                      if (openPanel !== 'photo') setOpenPanel(null);
                    }}
                  />
                </>
              ) : null
            }
          />
          {mode === 'Items' && photoBusy ? (
            <ThemedText type="small" themeColor="textSecondary">
              Finding similar items…
            </ThemedText>
          ) : null}
          {mode === 'Items' && openPanel === 'photo' ? renderPanel() : null}
          {photoMessage ? (
            <ThemedText type="small" themeColor="danger">
              {photoMessage}
            </ThemedText>
          ) : null}
          {mode === 'Items' && photoSearch ? (
            <View style={styles.photoSearch}>
              <Image source={{ uri: photoSearch.uri }} style={styles.photoThumb} contentFit="cover" />
              <ThemedText type="small" themeColor="textSecondary" style={styles.photoLabel}>
                Similar to your photo
              </ThemedText>
              <Pressable onPress={() => setPhotoSearch(null)} accessibilityRole="button" hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Clear
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
          {mode === 'Items' && !photoSearch && showUnderstood ? (
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
              {showFilters ? (
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
              ) : null}
              {openPanel !== 'photo' ? renderPanel() : null}
            </>
          ) : null}
          <View style={styles.summary}>
            <ThemedText type="small" themeColor="textSecondary">
              {countLabel}
            </ThemedText>
            {mode === 'Items' && (filterCount > 0 || availableToday || photoSearch) ? (
              <Pressable
                onPress={() => {
                  setFilters(EMPTY_FILTERS);
                  setAvailableToday(false);
                  setPhotoMessage(null);
                  setPhotoSearch(null);
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
          <ListingGrid
            listings={results}
            emptyText={photoSearch ? 'No similar items found.' : 'No items match your search.'}
          />
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
  photoMenu: {
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  photoOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
  photoSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  photoThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  photoLabel: {
    flex: 1,
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

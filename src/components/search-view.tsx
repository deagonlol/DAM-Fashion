import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ListingGrid } from '@/components/listing-grid';
import { PeopleStrip } from '@/components/people-strip';
import { SearchHeader, type AppliedFilters } from '@/components/search-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
import { CATEGORIES, EVENTS, SORT_OPTIONS, type ListingFilters, type ListingSort } from '@/lib/data/types';
import { formatPrice } from '@/lib/format';

/** People show up once the search is this long, so one letter doesn't list everyone. */
const MIN_PEOPLE_QUERY = 2;

export type SearchParams = {
  /** A typed search from Home. */
  q?: string;
  /** An event tile from Home. */
  event?: string;
  /** A clothing type chip from Home's Trending row. */
  category?: string;
  sort?: string;
  /** Home's camera menu: start a photo search right away. */
  photo?: string;
};

/** The filters a search starts with, from whatever Home passed in. */
function initialFilters({ q, event, category }: SearchParams): ListingFilters {
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
      deal: null,
    };
  }
  const events = EVENTS.filter((tag) => tag === event);
  const categories = CATEGORIES.filter((type) => type === category);
  return { ...EMPTY_FILTERS, events, categories };
}

/**
 * Search results: the full listing grid with smart search, photo search, filters, and sort. Uses the
 * same search bar and dropdowns as Home. Shown in place on Home (with Cancel), and as its own screen
 * for links from elsewhere.
 */
type SearchViewProps = {
  params: SearchParams;
  /** The tab title row above the bar, when shown on Home. */
  title?: string;
  /** Filters picked in Home's filter dropdown. */
  initialFilters?: ListingFilters;
  initialAvailableToday?: boolean;
  initialSort?: ListingSort;
  onCancel?: () => void;
};

export function SearchView({
  params,
  title,
  initialFilters: picked,
  initialAvailableToday,
  initialSort,
  onCancel,
}: SearchViewProps) {
  const [filters, setFilters] = useState<ListingFilters>(() => picked ?? initialFilters(params));
  /** What's in the search bar. Item searches run on submit, like on Home; people search as you type. */
  const [text, setText] = useState(filters.query);
  const [sort, setSort] = useState<ListingSort>(
    () => initialSort ?? SORT_OPTIONS.find((option) => option === params.sort) ?? 'For you'
  );
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  /** The photo being searched with and the listings that look like it, closest first. */
  const [photoSearch, setPhotoSearch] = useState<{ uri: string; matches: PhotoMatch[] } | null>(null);
  const [availableToday, setAvailableToday] = useState(initialAvailableToday ?? false);
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
  const peopleQuery = filters.query.trim().length >= MIN_PEOPLE_QUERY ? filters.query.trim() : '';
  const matchedPeople = useBrowsePeople(peopleQuery);
  const people = peopleQuery ? matchedPeople.slice(0, 12) : [];

  const filterCount =
    filters.categories.length + filters.events.length + filters.sizes.length + (filters.maxPrice !== null ? 1 : 0);
  const count = results.length;
  const countLabel = `${count} ${count === 1 ? 'item' : 'items'}`;

  function update(patch: Partial<ListingFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
  }

  function applyIntent(intent: SearchIntent, query: string) {
    setPhotoMessage(null);
    setPhotoSearch(null);
    setFilters((current) => ({
      query,
      words: intent.words,
      interpreted: true,
      categories: intent.categories,
      events: intent.events,
      sizes: intent.sizes,
      maxPrice: intent.maxPrice,
      // Keep the Rent / Buy choice: a new search shouldn't undo it.
      deal: current.deal,
    }));
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
      // Typed words would hide visual matches whose titles don't mention them. Chips still narrow.
      update({ query: '', words: [], interpreted: false });
      setText('');
      setPhotoSearch({ uri: asset.uri, matches });
    } catch (e) {
      setPhotoMessage(e instanceof Error ? e.message : 'Photo search failed.');
    } finally {
      setPhotoBusy(false);
    }
  }

  // Home's camera menu picked camera or library: start that photo search right away.
  useEffect(() => {
    const source = params.photo;
    if (source !== 'camera' && source !== 'library') return;
    // After this render, so the picker opens over the search screen.
    const timer = setTimeout(() => void searchByPhoto(source), 0);
    return () => clearTimeout(timer);
    // Only once, when search opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function runSearch(query: string) {
    const trimmed = query.trim();
    setText(trimmed);
    applyIntent(parseSearchQuery(trimmed), trimmed);
  }

  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setText('');
    setAvailableToday(false);
    setSort('For you');
    setPhotoMessage(null);
    setPhotoSearch(null);
  }

  function applyFilters(next: AppliedFilters) {
    setFilters(next.filters);
    setAvailableToday(next.availableToday);
    setSort(next.sort);
  }

  const hasFilters = filterCount > 0 || availableToday || photoSearch || filters.deal !== null || sort !== 'For you';

  const below: ReactNode = (
    <>
      {photoBusy ? (
        <ThemedText type="small" themeColor="textSecondary">
          Finding similar items…
        </ThemedText>
      ) : null}
      {photoMessage ? (
        <ThemedText type="small" themeColor="danger">
          {photoMessage}
        </ThemedText>
      ) : null}
      {photoSearch ? (
        <View style={styles.photoSearch}>
          <Image source={{ uri: photoSearch.uri }} style={styles.photoThumb} contentFit="cover" />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            Similar to your photo
          </ThemedText>
          <Pressable onPress={() => setPhotoSearch(null)} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Clear
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      {!photoSearch && showUnderstood ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {showUnderstood ? `Looking for ${understood.join(' · ')}` : ''}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
          {countLabel}
          {sort !== 'For you' ? ` · ${sort}` : ''}
        </ThemedText>
        {hasFilters ? (
          <Pressable onPress={clearAll} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Clear all filters
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </>
  );

  return (
    <ThemedView style={styles.container}>
      <SearchHeader
        title={title}
        query={text}
        onChangeQuery={(next) => {
          setText(next);
          // Clearing the bar clears the typed part of the search.
          if (!next.trim() && filters.query) runSearch('');
        }}
        onSubmit={runSearch}
        placeholder="Try “black formal dress” or a name"
        autoFocus={!params.q && !params.event && !params.category && !params.sort && !params.photo && !picked}
        applied={{ filters, availableToday, sort }}
        onApplyFilters={applyFilters}
        onPhoto={(source) => void searchByPhoto(source)}
        photoBusy={photoBusy}
        onCancel={onCancel}
        below={below}>
        <ListingGrid
          listings={results}
          header={<PeopleStrip people={people} />}
          emptyText={
            photoSearch
              ? 'No similar items found.'
              : people.length > 0
                ? 'No items match.'
                : 'No items match your search.'
          }
        />
      </SearchHeader>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
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
  empty: {
    textAlign: 'center',
    padding: Spacing.five,
  },
});

import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { BackHandler, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ComingUp } from '@/components/coming-up';
import { ListingCard } from '@/components/listing-card';
import { SearchHeader, type AppliedFilters } from '@/components/search-header';
import { SearchView, type SearchParams } from '@/components/search-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { EVENT_ICONS } from '@/constants/event-icons';
import { Fonts, Spacing } from '@/constants/theme';
import { useBrowseListings, useTrendingListings } from '@/hooks/use-browse';
import { useBorrowedListings } from '@/hooks/use-listings';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_FILTERS, matchesFilters } from '@/lib/data/listings';
import { CATEGORIES, type EventTag, type Listing, type ListingFilters, type ListingSort } from '@/lib/data/types';
import { hasSeenTour } from '@/lib/tour';

const ROW_LENGTH = 10;
/** Rows added each time the bottom of Home comes into view. */
const ROWS_PER_PAGE = 4;

/** Shorter names for the event tiles and rows. */
const EVENT_LABELS: Partial<Record<EventTag, string>> = {
  Professional: 'Career Fair',
  'Concert & Festival': 'Festival',
};
const eventLabel = (event: EventTag) => EVENT_LABELS[event] ?? event;

/** Order students reach for events in. */
const TILE_ORDER: EventTag[] = [
  'Game Day',
  'Professional',
  'Formal',
  'Semi-Formal',
  'Themed Party',
  'Concert & Festival',
  'Western',
  'Halloween',
  'Graduation',
];

type RowSpec = {
  key: string;
  title: string;
  /** Opens search with these when "View all" is tapped. */
  params: SearchParams;
  filters?: ListingFilters;
  sort?: ListingSort;
  trending?: boolean;
  /** "More for you" rows: a different mix of everything, picked by this number. */
  shuffle?: number;
};

/** Mixed event + type rows ("Formal dresses") need at least this many pieces to show. */
const MIN_COMBO = 3;
/** Stop adding "More for you" rows somewhere nobody scrolls to. */
const MAX_ROWS = 200;
const MORE_TITLES = ['More for you', 'You might like', 'Just in', 'Keep scrolling', 'Fresh finds'];

/** Same order every time for the same seed, so a row doesn't reshuffle while you look at it. */
function seededShuffle<T>(items: T[], seed: number) {
  const out = [...items];
  let state = seed * 2654435761;
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const moreRow = (n: number): RowSpec => ({
  key: `more-${n}`,
  title: MORE_TITLES[n % MORE_TITLES.length],
  params: { sort: 'For you' },
  shuffle: n + 1,
});

/**
 * Home's rows, top to bottom, Netflix-style. Defined once here so each row's filters keep the
 * same identity between renders. Rows with nothing in them are skipped.
 */
/** First row once someone has hearted, shelved, or borrowed anything: ranked by their taste. */
const PICKED_ROW: RowSpec = { key: 'picked', title: 'Picked for you', params: { sort: 'For you' }, sort: 'For you' };

const ROWS: RowSpec[] = [
  { key: 'trending', title: 'Trending now', params: { sort: 'For you' }, trending: true },
  { key: 'new', title: 'New arrivals', params: { sort: 'Newest' }, sort: 'Newest' },
  ...TILE_ORDER.map((event) => ({
    key: `event-${event}`,
    title: `For ${eventLabel(event)}`,
    params: { event },
    filters: { ...EMPTY_FILTERS, events: [event] },
  })),
  {
    key: 'cheap',
    title: 'Under $5 a day',
    params: { sort: 'Price: low to high' },
    filters: { ...EMPTY_FILTERS, maxPrice: 5 },
  },
  { key: 'buy', title: 'For sale', params: { sort: 'Newest' }, filters: { ...EMPTY_FILTERS, deal: 'Buy' } },
  ...CATEGORIES.map((category) => ({
    key: `type-${category}`,
    title: category,
    params: { category },
    filters: { ...EMPTY_FILTERS, categories: [category] },
  })),
];

/** Home: search, events, and endless rows of listings. Search results open in place. */
export default function HomeScreen() {
  const user = useCurrentUser();
  /** Results take over Home once someone actually searches. Null while browsing. */
  const [searching, setSearching] = useState<{
    key: number;
    params: SearchParams;
    filters?: ListingFilters;
    availableToday?: boolean;
    sort?: ListingSort;
  } | null>(null);
  const [query, setQuery] = useState('');
  const saved = useSavedListings(user.id);
  const borrowed = useBorrowedListings(user.id);
  const hasTaste = saved.length > 0 || borrowed.length > 0;
  const [rowCount, setRowCount] = useState(ROWS_PER_PAGE);
  // Filtered and sorted once here; each row just picks from these. Doing it per row made fast
  // scrolling stutter, since every row re-ran the whole catalog.
  const everything = useBrowseListings(EMPTY_FILTERS, 'Newest');
  const forYou = useBrowseListings(EMPTY_FILTERS, 'For you');
  const trending = useTrendingListings(ROW_LENGTH);
  // Event + type pairs that have enough pieces, like "Formal dresses", after the single rows.
  const rows = useMemo(() => {
    const combos: RowSpec[] = [];
    for (const event of TILE_ORDER) {
      for (const category of CATEGORIES) {
        const count = everything.filter(
          (listing) => listing.category === category && listing.events.includes(event)
        ).length;
        if (count < MIN_COMBO) continue;
        combos.push({
          key: `combo-${event}-${category}`,
          title: `${eventLabel(event)} ${category.toLowerCase()}`,
          params: { event, category },
          filters: { ...EMPTY_FILTERS, events: [event], categories: [category] },
        });
      }
    }
    const finite = [...(hasTaste ? [PICKED_ROW] : []), ...ROWS, ...combos];
    // Past the real rows, keep going with fresh mixes so Home never ends.
    return rowCount <= finite.length
      ? finite.slice(0, rowCount)
      : [...finite, ...Array.from({ length: rowCount - finite.length }, (_, n) => moreRow(n))];
  }, [everything, rowCount, hasTaste]);

  const filled = useMemo(
    () =>
      rows
        .map((spec) => {
          let listings: Listing[];
          if (spec.trending) listings = trending;
          else {
            const base = spec.sort === 'Newest' ? everything : forYou;
            const pool = spec.filters ? base.filter((listing) => matchesFilters(listing, spec.filters!)) : base;
            listings = spec.shuffle
              ? seededShuffle(pool, spec.shuffle).slice(0, ROW_LENGTH)
              : pool.slice(0, ROW_LENGTH);
          }
          return { spec, listings };
        })
        .filter((row) => row.listings.length > 0),
    [rows, trending, everything, forYou]
  );

  // New on this device: show the quick tour once.
  useEffect(() => {
    let cancelled = false;
    void hasSeenTour().then((seen) => {
      if (!seen && !cancelled) router.push('/tour');
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Android's back button leaves search results before leaving Home.
  useEffect(() => {
    if (!searching) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setSearching(null);
      return true;
    });
    return () => subscription.remove();
  }, [searching]);

  const openSearch = useCallback((params: SearchParams = {}, extra?: AppliedFilters) => {
    setQuery('');
    setSearching((current) => ({ key: (current?.key ?? 0) + 1, params, ...extra }));
  }, []);

  function submit(text: string) {
    const q = text.trim();
    if (!q) return;
    openSearch({ q });
  }

  if (searching) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <SearchView
            key={searching.key}
            title="Lendr"
            params={searching.params}
            initialFilters={searching.filters}
            initialAvailableToday={searching.availableToday}
            initialSort={searching.sort}
            onCancel={() => setSearching(null)}
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <SearchHeader
          title="Lendr"
          query={query}
          onChangeQuery={setQuery}
          onSubmit={submit}
          applied={{ filters: EMPTY_FILTERS, availableToday: false, sort: 'For you' }}
          onApplyFilters={(applied) => openSearch({}, applied)}
          onPhoto={(source) => openSearch({ photo: source })}>
          <FlatList
            data={filled}
            keyExtractor={(row) => row.spec.key}
            renderItem={({ item }) => <ListingRow spec={item.spec} listings={item.listings} onViewAll={openSearch} />}
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={7}
            removeClippedSubviews
            onEndReached={() => setRowCount((count) => Math.min(count + ROWS_PER_PAGE, MAX_ROWS))}
            onEndReachedThreshold={0.8}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
            ListHeaderComponent={
              <View style={styles.listHeader}>
                <View style={styles.padded}>
                  <ComingUp />
                </View>
                <View style={styles.section}>
                  <ThemedText style={[styles.padded, styles.hero]}>
                    Find your fit{' '}
                    <ThemedText style={styles.hero} themeColor="accent">
                      on campus
                    </ThemedText>
                  </ThemedText>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                    {TILE_ORDER.map((event) => (
                      <EventTile key={event} event={event} onPress={() => openSearch({ event })} />
                    ))}
                  </ScrollView>
                </View>
              </View>
            }
          />
        </SearchHeader>
      </SafeAreaView>
    </ThemedView>
  );
}

function EventTile({ event, onPress }: { event: EventTag; onPress: () => void }) {
  const theme = useTheme();
  const label = eventLabel(event);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label} outfits`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.tileIcon, { backgroundColor: theme.backgroundElement }]}>
        <SymbolView name={EVENT_ICONS[event]} tintColor={theme.accent} size={26} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tileLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type ListingRowProps = { spec: RowSpec; listings: Listing[]; onViewAll: (params: SearchParams) => void };

const ListingRow = memo(function ListingRow({ spec, listings, onViewAll }: ListingRowProps) {
  return (
    <View style={styles.section}>
      <View style={[styles.padded, styles.sectionHeader]}>
        <ThemedText style={styles.sectionTitle}>{spec.title}</ThemedText>
        <Pressable
          onPress={() => onViewAll(spec.params)}
          accessibilityRole="link"
          accessibilityLabel={`View all ${spec.title}`}
          hitSlop={8}>
          <ThemedText type="smallBold" themeColor="accent" style={styles.viewAll}>
            View all
          </ThemedText>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <ListingCard listing={item} />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        initialNumToRender={3}
        windowSize={3}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.five,
    gap: Spacing.five,
  },
  listHeader: {
    gap: Spacing.five,
  },
  padded: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.three,
  },
  hero: {
    fontFamily: Fonts.heading,
    fontSize: 30,
    lineHeight: 36,
  },
  row: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  tile: {
    width: 76,
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  tileIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: 22,
    lineHeight: 28,
  },
  viewAll: {
    fontSize: 12,
    textTransform: 'uppercase',
  },
  card: {
    width: 150,
  },
});

import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip-group';
import { ListingCard } from '@/components/listing-card';
import { ProfileButton } from '@/components/profile-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useBrowseListings, useTrendingListings } from '@/hooks/use-browse';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { CATEGORIES, type Category, type EventTag, type Listing } from '@/lib/data/types';

const ROW_LENGTH = 10;

/** Event tiles, in the order students reach for them. Each opens search filtered to that event. */
const EVENT_TILES: { event: EventTag; label: string; icon: string }[] = [
  { event: 'Game Day', label: 'Game Day', icon: '🏈' },
  { event: 'Professional', label: 'Career Fair', icon: '💼' },
  { event: 'Formal', label: 'Formal', icon: '🥂' },
  { event: 'Semi-Formal', label: 'Semi-Formal', icon: '✨' },
  { event: 'Themed Party', label: 'Themed Party', icon: '🎉' },
  { event: 'Concert & Festival', label: 'Festival', icon: '🎶' },
  { event: 'Western', label: 'Western', icon: '🤠' },
  { event: 'Halloween', label: 'Halloween', icon: '🎃' },
  { event: 'Graduation', label: 'Graduation', icon: '🎓' },
];

/** Home: search, browse by event, and what's trending or new. The full grid lives on Search. */
export default function HomeScreen() {
  const [query, setQuery] = useState('');
  const [trendingType, setTrendingType] = useState<Category | null>(null);
  const trending = useTrendingListings(ROW_LENGTH, trendingType);
  const newest = useBrowseListings(EMPTY_FILTERS, 'Newest').slice(0, ROW_LENGTH);

  function search() {
    const q = query.trim();
    router.push(q ? { pathname: '/search', params: { q } } : '/search');
    setQuery('');
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.padded}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle" themeColor="accent">
                Lendr
              </ThemedText>
              <ProfileButton />
            </View>
            <TextField
              variant="search"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={search}
              placeholder="Search for outfits, clubs, or events…"
              returnKeyType="search"
              autoCorrect={false}
            />
          </View>

          <View style={styles.section}>
            <ThemedText style={[styles.padded, styles.hero]}>
              Find your fit <ThemedText style={styles.hero} themeColor="accent">on campus</ThemedText>
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {EVENT_TILES.map((tile) => (
                <EventTile key={tile.event} {...tile} />
              ))}
            </ScrollView>
          </View>

          <ListingRow
            title="Trending now"
            listings={trending}
            onViewAll={() =>
              router.push(trendingType ? { pathname: '/search', params: { category: trendingType } } : '/search')
            }
            filter={
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <Chip label="All" selected={trendingType === null} onPress={() => setTrendingType(null)} />
                {CATEGORIES.map((category) => (
                  <Chip
                    key={category}
                    label={category}
                    selected={trendingType === category}
                    onPress={() => setTrendingType(category)}
                  />
                ))}
              </ScrollView>
            }
            emptyText={trendingType ? `No ${trendingType.toLowerCase()} trending right now.` : undefined}
          />
          <ListingRow
            title="New Arrivals"
            listings={newest}
            onViewAll={() => router.push({ pathname: '/search', params: { sort: 'Newest' } })}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function EventTile({ event, label, icon }: { event: EventTag; label: string; icon: string }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/search', params: { event } })}
      accessibilityRole="button"
      accessibilityLabel={`Browse ${label} outfits`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}>
      <View style={[styles.tileIcon, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.tileEmoji}>{icon}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.tileLabel} numberOfLines={1}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

type ListingRowProps = {
  title: string;
  listings: Listing[];
  onViewAll: () => void;
  /** Optional chips under the title, e.g. to narrow by type. */
  filter?: ReactNode;
  /** Shown instead of hiding the row when it's empty (only when there's a filter to change). */
  emptyText?: string;
};

function ListingRow({ title, listings, onViewAll, filter, emptyText }: ListingRowProps) {
  if (listings.length === 0 && !emptyText) return null;
  return (
    <View style={styles.section}>
      <View style={[styles.padded, styles.sectionHeader]}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        <Pressable onPress={onViewAll} accessibilityRole="link" accessibilityLabel={`View all ${title}`} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="accent" style={styles.viewAll}>
            View all
          </ThemedText>
        </Pressable>
      </View>
      {filter}
      {listings.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.padded}>
          {emptyText}
        </ThemedText>
      ) : null}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.five,
  },
  padded: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  chips: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
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
  tileEmoji: {
    fontSize: 28,
    lineHeight: 34,
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

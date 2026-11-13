import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { FilterMenu } from '@/components/filter-menu';
import { SearchBar, SearchBarButton } from '@/components/search-bar';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useBrowseListings } from '@/hooks/use-browse';
import { useRentals } from '@/hooks/use-rentals';
import { useTheme } from '@/hooks/use-theme';
import { EMPTY_FILTERS } from '@/lib/data/listings';
import { isAvailableOn, toDateString } from '@/lib/data/rentals';
import type { ListingFilters, ListingSort } from '@/lib/data/types';

export type AppliedFilters = { filters: ListingFilters; availableToday: boolean; sort: ListingSort };

type Props = {
  /** Shows the tab title row (bell, profile) above the bar. Leave out under a navigation header. */
  title?: string;
  query: string;
  onChangeQuery: (text: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Item search gets suggestions, the camera, and filters. People search is just the bar. */
  itemSearch?: boolean;
  /** What's applied now; the filters dropdown starts from these. */
  applied: AppliedFilters;
  onApplyFilters: (next: AppliedFilters) => void;
  onPhoto: (source: 'camera' | 'library') => void;
  photoBusy?: boolean;
  /** Always shows Cancel, e.g. to leave search results. */
  onCancel?: () => void;
  /** Under the bar, inside the header (chips, result count). */
  below?: ReactNode;
  /** The page under the header. Dims behind an open dropdown; tapping it closes the dropdown. */
  children: ReactNode;
};

/**
 * The search bar used on Home and in search results, so both look and work the same: a photo menu
 * behind the camera, and every filter behind the filters button. Each
 * opens as a small dropdown over the page.
 */
export function SearchHeader({
  title,
  query,
  onChangeQuery,
  onSubmit,
  placeholder = 'Search for outfits, clubs, or events…',
  autoFocus,
  itemSearch = true,
  applied,
  onApplyFilters,
  onPhoto,
  photoBusy,
  onCancel,
  below,
  children,
}: Props) {
  const theme = useTheme();
  const [dropdown, setDropdown] = useState<'photo' | 'filters' | null>(null);
  /** Filters being picked in the dropdown, before "Show results". */
  const [draft, setDraft] = useState<AppliedFilters>(applied);
  const rentals = useRentals();
  const draftMatches = useBrowseListings(draft.filters, draft.sort);
  const draftCount = useMemo(() => {
    if (!draft.availableToday) return draftMatches.length;
    const today = toDateString(new Date());
    return draftMatches.filter((listing) => isAvailableOn(rentals, listing, today)).length;
  }, [draftMatches, draft.availableToday, rentals]);

  // Android's back button closes the dropdown first.
  useEffect(() => {
    if (!dropdown) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => subscription.remove();
  }, [dropdown]);

  function close() {
    Keyboard.dismiss();
    setDropdown(null);
  }

  function toggle(next: 'photo' | 'filters') {
    Keyboard.dismiss();
    if (next === 'filters' && dropdown !== 'filters') setDraft(applied);
    setDropdown((open) => (open === next ? null : next));
  }

  const bar = (
    <View style={styles.searchWrap}>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <SearchBar
            value={query}
            onChangeText={onChangeQuery}
            onSubmitEditing={() => {
              close();
              onSubmit(query);
            }}
            placeholder={placeholder}
            returnKeyType="search"
            autoCorrect={false}
            autoFocus={autoFocus}
            clearButtonMode="while-editing"
            actions={
              itemSearch ? (
                <>
                  <SearchBarButton
                    icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                    accessibilityLabel="Search with a photo"
                    active={dropdown === 'photo'}
                    busy={photoBusy}
                    onPress={() => toggle('photo')}
                  />
                  <SearchBarButton
                    icon={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
                    accessibilityLabel="Filters"
                    active={dropdown === 'filters'}
                    onPress={() => toggle('filters')}
                  />
                </>
              ) : null
            }
          />
        </View>
        {dropdown || onCancel ? (
          <Pressable onPress={dropdown ? close : onCancel} accessibilityRole="button" hitSlop={8}>
            <ThemedText themeColor="accent">Cancel</ThemedText>
          </Pressable>
        ) : null}
      </View>

      {dropdown ? (
        <Animated.View
          entering={FadeIn.duration(120)}
          exiting={FadeOut.duration(100)}
          style={[
            styles.dropdown,
            dropdown === 'photo' ? styles.photoDropdown : null,
            { backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}>
          {dropdown === 'photo' ? (
            <>
              <MenuOption
                icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                label="Take a photo"
                onPress={() => {
                  close();
                  onPhoto('camera');
                }}
              />
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <MenuOption
                icon={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }}
                label="Choose from library"
                onPress={() => {
                  close();
                  onPhoto('library');
                }}
              />
            </>
          ) : dropdown === 'filters' ? (
            <FilterMenu
              filters={draft.filters}
              onChange={(filters) => setDraft((current) => ({ ...current, filters }))}
              availableToday={draft.availableToday}
              onAvailableToday={(availableToday) => setDraft((current) => ({ ...current, availableToday }))}
              sort={draft.sort}
              onSort={(sort) => setDraft((current) => ({ ...current, sort }))}
              count={draftCount}
              onClear={() =>
                setDraft((current) => ({
                  // Clearing filters keeps what was typed.
                  filters: { ...EMPTY_FILTERS, query: current.filters.query, words: current.filters.words },
                  availableToday: false,
                  sort: 'For you',
                }))
              }
              onApply={() => {
                close();
                onApplyFilters(draft);
              }}
            />
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );

  return (
    <>
      {title ? (
        <TabHeader title={title} style={styles.top}>
          {bar}
          {below}
        </TabHeader>
      ) : (
        <View style={[styles.plainHeader, styles.top]}>
          {bar}
          {below}
        </View>
      )}
      <View style={styles.flex}>
        {children}
        {dropdown ? (
          <Pressable
            onPress={close}
            accessibilityLabel="Close search menu"
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        ) : null}
      </View>
    </>
  );
}

type MenuOptionProps = {
  icon: React.ComponentProps<typeof SymbolView>['name'];
  label: string;
  onPress: () => void;
};

function MenuOption({ icon, label, onPress }: MenuOptionProps) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuOption, pressed && styles.pressed]}>
      <SymbolView name={icon} tintColor={theme.accent} size={18} />
      <ThemedText type="small">{label}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  top: {
    zIndex: 10,
  },
  plainHeader: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.three,
  },
  searchWrap: {
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  photoDropdown: {
    left: undefined,
    width: 220,
    paddingVertical: 0,
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  backdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  pressed: {
    opacity: 0.7,
  },
});

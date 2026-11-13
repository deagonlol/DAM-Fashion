import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip, ChipGroup, MultiChipGroup } from '@/components/chip-group';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import {
  CATEGORIES,
  DEALS,
  EVENTS,
  SIZES,
  SORT_OPTIONS,
  type ListingFilters,
  type ListingSort,
} from '@/lib/data/types';

const PRICE_LIMITS = [5, 10, 20] as const;
const PRICE_LABELS = PRICE_LIMITS.map((price) => `Up to $${price}/day`);

type Props = {
  filters: ListingFilters;
  onChange: (filters: ListingFilters) => void;
  availableToday: boolean;
  onAvailableToday: (on: boolean) => void;
  sort?: ListingSort;
  onSort?: (sort: ListingSort) => void;
  /** How many listings these filters show, for the button. */
  count: number;
  onApply: () => void;
  onClear: () => void;
};

/** Every filter in one dropdown, like Vinted's: pick what you want, then show the results. */
export function FilterMenu({
  filters,
  onChange,
  availableToday,
  onAvailableToday,
  sort,
  onSort,
  count,
  onApply,
  onClear,
}: Props) {
  const update = (patch: Partial<ListingFilters>) => onChange({ ...filters, ...patch });
  const priceLabel = filters.maxPrice !== null ? `Up to $${filters.maxPrice}/day` : null;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.sections} keyboardShouldPersistTaps="handled">
        <Section title="Rent or buy">
          <View style={styles.inline}>
            <ChipGroup
              options={DEALS}
              value={filters.deal}
              allowDeselect
              onChange={(deal) => update({ deal: deal ?? null })}
            />
            <Chip
              label="Available today"
              selected={availableToday}
              accessibilityRole="checkbox"
              onPress={() => onAvailableToday(!availableToday)}
            />
          </View>
        </Section>
        <Section title="Event">
          <MultiChipGroup options={EVENTS} values={filters.events} onChange={(events) => update({ events })} />
        </Section>
        <Section title="Type">
          <MultiChipGroup
            options={CATEGORIES}
            values={filters.categories}
            onChange={(categories) => update({ categories })}
          />
        </Section>
        <Section title="Size">
          <MultiChipGroup options={SIZES} values={filters.sizes} onChange={(sizes) => update({ sizes })} />
        </Section>
        <Section title="Price">
          <ChipGroup
            options={PRICE_LABELS}
            value={priceLabel}
            allowDeselect
            onChange={(label) => update({ maxPrice: label ? PRICE_LIMITS[PRICE_LABELS.indexOf(label)] : null })}
          />
        </Section>
        {sort && onSort ? (
          <Section title="Sort by">
            <ChipGroup options={SORT_OPTIONS} value={sort} onChange={(next) => next && onSort(next)} />
          </Section>
        ) : null}
      </ScrollView>
      {/* Pinned under the scrolling filters so "Show results" is always in reach. */}
      <View style={styles.actions}>
        <Button title="Clear" variant="secondary" style={styles.flex} onPress={onClear} />
        <Button title={`Show ${count} ${count === 1 ? 'result' : 'results'}`} style={styles.grow} onPress={onApply} />
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title.toUpperCase()}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  scroll: {
    maxHeight: 380,
  },
  sections: {
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  grow: {
    flex: 2,
  },
});

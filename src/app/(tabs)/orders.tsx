import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipGroup } from '@/components/chip-group';
import { OrderCard, SaleOrderCard } from '@/components/order-card';
import { SearchBar } from '@/components/search-bar';
import { TabHeader } from '@/components/tab-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListing } from '@/hooks/use-listings';
import { useOrders, type OrderItem } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useUser } from '@/hooks/use-users';

const SIDES = ['Rent/Buy', 'Lend/Sell'] as const;
type Side = (typeof SIDES)[number];

type Tab = 'active' | 'past' | 'requests';

const TABS: Record<Side, { key: Tab; label: string }[]> = {
  'Rent/Buy': [
    { key: 'active', label: 'Active Rentals' },
    { key: 'past', label: 'Past Rentals' },
  ],
  'Lend/Sell': [
    { key: 'active', label: 'Active Lending' },
    { key: 'past', label: 'Past Lending' },
    { key: 'requests', label: 'Requests' },
  ],
};

const EMPTY: Record<Side, Record<Tab, string>> = {
  'Rent/Buy': {
    active: 'Nothing borrowed or on the way right now. Find something on Home.',
    past: 'Items you’ve returned or bought will show up here.',
    requests: '',
  },
  'Lend/Sell': {
    active: 'No one is borrowing your items right now.',
    past: 'Items that came back to you, or that you sold, will show up here.',
    requests: 'No requests waiting. New borrow and buy requests show up here.',
  },
};

const keyOf = (item: OrderItem) => (item.kind === 'rental' ? `r-${item.rental.id}` : `s-${item.sale.id}`);

/** Your orders: what you're renting or buying, and what you're lending or selling. */
export default function OrdersScreen() {
  const user = useCurrentUser();
  const theme = useTheme();
  const [side, setSide] = useState<Side>('Rent/Buy');
  const [tab, setTab] = useState<Tab>('active');
  const [query, setQuery] = useState('');
  const role = side === 'Rent/Buy' ? 'borrower' : 'lender';
  const orders = useOrders(user.id, role, query);
  // Unfiltered by search, so the banner counts everything waiting.
  const waiting = useOrders(user.id, 'lender').requests;
  // Requests only exist on the Lend/Sell side.
  const shownTab: Tab = TABS[side].some((option) => option.key === tab) ? tab : 'active';
  const items = orders[shownTab];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <TabHeader title="My Orders">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder={side === 'Rent/Buy' ? 'Search items or lenders…' : 'Search items or renters…'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <ChipGroup variant="segment" options={SIDES} value={side} onChange={(next) => next && setSide(next)} />
          {side === 'Lend/Sell' && shownTab !== 'requests' && waiting.length > 0 ? (
            <RequestBanner first={waiting[0]} count={waiting.length} onReview={() => setTab('requests')} />
          ) : null}
          <View style={[styles.tabs, { borderColor: theme.border }]} accessibilityRole="tablist">
            {TABS[side].map((option) => {
              const selected = option.key === shownTab;
              const count = option.key === 'requests' ? waiting.length : 0;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => setTab(option.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.tab, selected && { borderColor: theme.accent }]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
                    {option.label}
                    {count > 0 ? ` (${count})` : ''}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </TabHeader>
        <FlatList
          data={items}
          keyExtractor={keyOf}
          renderItem={({ item }) =>
            item.kind === 'rental' ? (
              <OrderCard rental={item.rental} role={role} />
            ) : (
              <SaleOrderCard sale={item.sale} role={role} />
            )
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {query.trim() ? 'No orders match your search.' : EMPTY[side][shownTab]}
            </ThemedText>
          }
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** "1 request waiting · Ronit wants to borrow your Black Slip Dress", with a Review button. */
function RequestBanner({ first, count, onReview }: { first: OrderItem; count: number; onReview: () => void }) {
  const theme = useTheme();
  const listingId = first.kind === 'rental' ? first.rental.listingId : first.sale.listingId;
  const listing = useListing(listingId);
  const asker = useUser(first.kind === 'rental' ? first.rental.borrowerId : first.sale.buyerId);
  const want = first.kind === 'rental' ? 'wants to borrow' : 'wants to buy';
  const title = `${count} request${count === 1 ? '' : 's'} waiting`;
  const detail = `${asker?.name ?? 'Someone'} ${want} your ${listing?.title ?? 'item'}${count > 1 ? `, and ${count - 1} more` : ''}`;

  return (
    <Pressable
      onPress={onReview}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}. Review`}
      style={({ pressed }) => [
        styles.banner,
        { borderColor: theme.accent, backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.bannerIcon, { backgroundColor: theme.accent }]}>
        <ThemedText type="smallBold" themeColor="onAccent">
          {count}
        </ThemedText>
      </View>
      <View style={styles.bannerText}>
        <ThemedText type="smallBold">{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" themeColor="accent">
        Review
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: Spacing.three,
  },
  bannerIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.four,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    paddingVertical: Spacing.two,
    borderBottomWidth: 2,
    borderColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  list: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
});

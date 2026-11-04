import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipGroup } from '@/components/chip-group';
import { OrderCard } from '@/components/order-card';
import { ProfileButton } from '@/components/profile-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useOrders } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';

const SIDES = ['Rent', 'Lend'] as const;
type Side = (typeof SIDES)[number];

const WHEN = ['Active', 'Past'] as const;
type When = (typeof WHEN)[number];

const EMPTY: Record<Side, Record<When, string>> = {
  Rent: {
    Active: 'Nothing borrowed right now. Find something on Home.',
    Past: 'Items you’ve returned will show up here.',
  },
  Lend: {
    Active: 'No one is borrowing your items right now.',
    Past: 'Items that came back to you will show up here.',
  },
};

/** Your borrows: what you're renting and what you're lending, current or past. */
export default function OrdersScreen() {
  const user = useCurrentUser();
  const theme = useTheme();
  const [side, setSide] = useState<Side>('Rent');
  const [when, setWhen] = useState<When>('Active');
  const [query, setQuery] = useState('');
  const role = side === 'Rent' ? 'borrower' : 'lender';
  const orders = useOrders(user.id, role, query);
  const items = when === 'Active' ? orders.active : orders.past;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" themeColor="accent">
              My Orders
            </ThemedText>
            <ProfileButton />
          </View>
          <TextField
            variant="search"
            value={query}
            onChangeText={setQuery}
            placeholder={side === 'Rent' ? 'Search items or lenders…' : 'Search items or borrowers…'}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
          />
          <ChipGroup variant="segment" options={SIDES} value={side} onChange={(next) => next && setSide(next)} />
          <View style={[styles.tabs, { borderColor: theme.border }]}>
            {WHEN.map((option) => {
              const selected = option === when;
              return (
                <Pressable
                  key={option}
                  onPress={() => setWhen(option)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[styles.tab, selected && { borderColor: theme.accent }]}>
                  <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'text' : 'textSecondary'}>
                    {option} {side === 'Rent' ? 'Rentals' : 'Lends'}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard rental={item} role={role} />}
          ListHeaderComponent={
            side === 'Lend' ? (
              <Pressable
                onPress={() => router.push('/list')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.addListing, { borderColor: theme.border }, pressed && styles.pressed]}>
                <ThemedText type="subtitle" themeColor="textSecondary">
                  +
                </ThemedText>
                <ThemedText type="smallBold">Add new listing</ThemedText>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {query.trim() ? 'No orders match your search.' : EMPTY[side][when]}
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
  addListing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
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

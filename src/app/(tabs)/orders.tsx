import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipGroup } from '@/components/chip-group';
import { OrderCard } from '@/components/order-card';
import { ProfileButton } from '@/components/profile-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useOutOnBorrow } from '@/hooks/use-rentals';
import { useCurrentUser } from '@/hooks/use-session';

const TABS = ['Rented', 'Lent'] as const;
type Tab = (typeof TABS)[number];

const EMPTY: Record<Tab, string> = {
  Rented: 'Nothing out on borrow',
  Lent: 'Nothing of yours is out right now',
};

/** Items currently out on borrow, split into what you rented and what you lent. */
export default function OrdersScreen() {
  const user = useCurrentUser();
  const { rented, lent } = useOutOnBorrow(user.id);
  const [tab, setTab] = useState<Tab>('Rented');
  const items = tab === 'Rented' ? rented : lent;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <ThemedText type="subtitle" themeColor="accent">
              Orders
            </ThemedText>
            <ProfileButton />
          </View>
          <ChipGroup
            variant="segment"
            options={TABS}
            value={tab}
            onChange={(next) => next && setTab(next)}
          />
        </View>
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard rental={item} />}
          ListEmptyComponent={
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              {EMPTY[tab]}
            </ThemedText>
          }
          contentContainerStyle={styles.list}
          contentInsetAdjustmentBehavior="automatic"
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
    paddingBottom: Spacing.two,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  list: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  empty: {
    textAlign: 'center',
    paddingTop: Spacing.five,
  },
});

import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ListingGrid } from '@/components/listing-grid';
import { ProfileButton } from '@/components/profile-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';

/** Saved listings — the closet of pieces you want to borrow. */
export default function ClosetScreen() {
  const user = useCurrentUser();
  const saved = useSavedListings(user.id);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" themeColor="accent">
            My Closet
          </ThemedText>
          <ProfileButton />
        </View>
        <ListingGrid listings={saved} emptyText="Tap the ♡ on any item to save it here." />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
});

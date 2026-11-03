import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { ListingGrid } from '@/components/listing-grid';
import { ProfileHeader } from '@/components/profile-header';
import { RentalRow } from '@/components/rental-row';
import { SaleRow } from '@/components/sale-row';
import { RestrictionBanner } from '@/components/restriction-banner';
import { ReviewList } from '@/components/review-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBorrowedListings, useListingsByOwner } from '@/hooks/use-listings';
import { useReports } from '@/hooks/use-moderation';
import { useActivity, type ActivityItem } from '@/hooks/use-rentals';
import { useSaleActivity, type SaleActivity } from '@/hooks/use-sales';
import { useReviewsAbout } from '@/hooks/use-reviews';
import { useCurrentUser } from '@/hooks/use-session';
import { signOut, updateProfilePhoto } from '@/lib/data/auth';

const SECTIONS = ['Closet', 'Borrowed', 'Reviews'] as const;
type Section = (typeof SECTIONS)[number];

const EMPTY_TEXT: Record<Exclude<Section, 'Reviews'>, string> = {
  Closet: 'Your closet is empty. List something to lend!',
  Borrowed: "You haven't borrowed anything yet.",
};

export default function ProfileScreen() {
  const user = useCurrentUser();
  const listed = useListingsByOwner(user.id);
  const borrowed = useBorrowedListings(user.id);
  const reviews = useReviewsAbout(user.id);
  const activity = useActivity(user.id);
  const saleActivity = useSaleActivity(user.id);
  const lending = activityEntries(activity, saleActivity, 'lender');
  const borrowing = activityEntries(activity, saleActivity, 'borrower');
  const openReports = useReports().filter((report) => report.status === 'open').length;
  const [section, setSection] = useState<Section>('Closet');

  async function changePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) {
      await updateProfilePhoto(result.assets[0].uri);
    }
  }

  const header = (
    <ProfileHeader user={user} onAvatarPress={changePhoto}>
      <View style={styles.stack}>
        <RestrictionBanner />
        <Button title="List an item" onPress={() => router.push('/list')} />
        <View style={styles.row}>
          <Button title="Edit profile" variant="secondary" style={styles.flex} onPress={() => router.push('/edit-profile')} />
          <Button title="Sign out" variant="secondary" style={styles.flex} onPress={signOut} />
        </View>
        {user.role === 'admin' ? (
          <Button title={`Review reports (${openReports} open)`} onPress={() => router.push('/admin/reports')} />
        ) : null}

        {lending.length > 0 || borrowing.length > 0 ? (
          <View style={styles.stack}>
            <ActivityGroup title="Lending" items={lending} />
            <ActivityGroup title="Borrowing" items={borrowing} />
          </View>
        ) : null}

        <ChipGroup options={SECTIONS} value={section} onChange={(next) => next && setSection(next)} />
      </View>
    </ProfileHeader>
  );

  return (
    <ThemedView style={styles.container}>
      {section === 'Reviews' ? (
        <ReviewList
          reviews={reviews}
          header={header}
          viewerId={user.id}
          emptyText="No reviews yet. They show up after your first borrow or lend."
        />
      ) : (
        <ListingGrid
          listings={section === 'Closet' ? listed : borrowed}
          emptyText={EMPTY_TEXT[section]}
          header={header}
        />
      )}
    </ThemedView>
  );
}

type ActivityEntry =
  | { kind: 'borrow'; priority: number; sortKey: string; item: ActivityItem }
  | { kind: 'sale'; priority: number; sortKey: string; item: SaleActivity };

function activityEntries(borrows: ActivityItem[], sales: SaleActivity[], role: 'lender' | 'borrower') {
  const entries: ActivityEntry[] = [
    ...borrows
      .filter((item) => item.role === role)
      .map((item) => ({ kind: 'borrow' as const, priority: item.priority, sortKey: item.rental.startDate, item })),
    ...sales
      .filter((item) => item.role === role)
      .map((item) => ({ kind: 'sale' as const, priority: item.priority, sortKey: item.sale.createdAt, item })),
  ];
  return entries.sort((a, b) => a.priority - b.priority || a.sortKey.localeCompare(b.sortKey));
}

function ActivityGroup({ title, items }: { title: string; items: ActivityEntry[] }) {
  if (items.length === 0) return null;
  return (
    <View style={styles.stack}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {items.map((entry) =>
        entry.kind === 'borrow' ? (
          <RentalRow key={`borrow-${entry.item.rental.id}`} item={entry.item} />
        ) : (
          <SaleRow key={`sale-${entry.item.sale.id}`} item={entry.item} />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  stack: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});

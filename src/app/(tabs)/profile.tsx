import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ChipGroup } from '@/components/chip-group';
import { ListingGrid } from '@/components/listing-grid';
import { ProfileHeader } from '@/components/profile-header';
import { RentalRow } from '@/components/rental-row';
import { RestrictionBanner } from '@/components/restriction-banner';
import { ReviewList } from '@/components/review-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useBorrowedListings, useListingsByOwner } from '@/hooks/use-listings';
import { useReports } from '@/hooks/use-moderation';
import { useActivity } from '@/hooks/use-rentals';
import { useReviewsAbout } from '@/hooks/use-reviews';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';
import { signOut, updateProfilePhoto } from '@/lib/data/auth';

const SECTIONS = ['Closet', 'Borrowed', 'Saved', 'Reviews'] as const;
type Section = (typeof SECTIONS)[number];

const EMPTY_TEXT: Record<Exclude<Section, 'Reviews'>, string> = {
  Closet: 'Your closet is empty. List something to lend!',
  Borrowed: "You haven't borrowed anything yet.",
  Saved: 'Tap the ♡ on any item to save it here.',
};

export default function ProfileScreen() {
  const user = useCurrentUser();
  const listed = useListingsByOwner(user.id);
  const borrowed = useBorrowedListings(user.id);
  const saved = useSavedListings(user.id);
  const reviews = useReviewsAbout(user.id);
  const activity = useActivity(user.id);
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
        <View style={styles.row}>
          <Button title="Edit profile" variant="secondary" style={styles.flex} onPress={() => router.push('/edit-profile')} />
          <Button title="Sign out" variant="secondary" style={styles.flex} onPress={signOut} />
        </View>
        {user.role === 'admin' ? (
          <Button title={`Review reports (${openReports} open)`} onPress={() => router.push('/admin/reports')} />
        ) : null}

        {activity.length > 0 ? (
          <View style={styles.stack}>
            <ThemedText type="smallBold">Activity</ThemedText>
            {activity.map((item) => (
              <RentalRow key={item.rental.id} item={item} />
            ))}
          </View>
        ) : null}

        <ChipGroup options={SECTIONS} value={section} onChange={(next) => next && setSection(next)} />
      </View>
    </ProfileHeader>
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {section === 'Reviews' ? (
          <ReviewList
            reviews={reviews}
            header={header}
            viewerId={user.id}
            emptyText="No reviews yet. They show up after your first borrow or lend."
          />
        ) : (
          <ListingGrid
            listings={section === 'Closet' ? listed : section === 'Borrowed' ? borrowed : saved}
            emptyText={EMPTY_TEXT[section]}
            header={header}
          />
        )}
      </SafeAreaView>
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
  stack: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});

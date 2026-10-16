import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChipGroup } from '@/components/chip-group';
import { ListingGrid } from '@/components/listing-grid';
import { ProfileHeader } from '@/components/profile-header';
import { ReviewList } from '@/components/review-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useListingsByOwner } from '@/hooks/use-listings';
import { useBlockState } from '@/hooks/use-moderation';
import { useReviewsAbout } from '@/hooks/use-reviews';
import { useCurrentUser } from '@/hooks/use-session';
import { useUser } from '@/hooks/use-users';
import { blockUser, unblockUser } from '@/lib/data/moderation';

const SECTIONS = ['Closet', 'Reviews'] as const;
type Section = (typeof SECTIONS)[number];

/** Another user's public profile: stats, what they lend, and what people say about them. */
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser(id);
  const listings = useListingsByOwner(id);
  const reviews = useReviewsAbout(id);
  const viewer = useCurrentUser();
  const { blockedByMe, blockedEitherWay } = useBlockState(viewer.id, id);
  const [section, setSection] = useState<Section>('Closet');

  if (!user) {
    return (
      <ThemedView style={styles.notFound}>
        <ThemedText themeColor="textSecondary">Profile not found.</ThemedText>
      </ThemedView>
    );
  }

  const firstName = user.name.split(' ')[0];
  const header = (
    <ProfileHeader user={user}>
      {blockedEitherWay ? (
        <ThemedText type="small" themeColor="textSecondary">
          {blockedByMe
            ? `You blocked ${firstName}. You won’t see each other’s listings or messages.`
            : `You can’t interact with ${firstName}.`}
        </ThemedText>
      ) : null}
      {viewer.id !== user.id ? (
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push({ pathname: '/report/[userId]', params: { userId: user.id } })}
            accessibilityRole="button"
            hitSlop={8}>
            <ThemedText type="small" themeColor="danger">
              Report {firstName}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => (blockedByMe ? unblockUser(user.id) : blockUser(user.id))}
            accessibilityRole="button"
            hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              {blockedByMe ? 'Unblock' : 'Block'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
      <ChipGroup options={SECTIONS} value={section} onChange={(next) => next && setSection(next)} />
    </ProfileHeader>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: user.name }} />
      {section === 'Closet' ? (
        <ListingGrid
          listings={blockedEitherWay ? [] : listings.filter((listing) => !listing.paused)}
          emptyText={blockedEitherWay ? 'Hidden because of a block.' : `${firstName}'s closet is empty.`}
          header={header}
        />
      ) : (
        <ReviewList reviews={reviews} header={header} emptyText={`No reviews for ${firstName} yet.`} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

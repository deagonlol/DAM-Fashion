import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet } from 'react-native';

import { ListingForm } from '@/components/listing-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useListing } from '@/hooks/use-listings';
import { updateListing } from '@/lib/data/listings';

/** Edit an existing listing with the same form used to create it. */
export default function EditListingScreen() {
  const { listingId } = useLocalSearchParams<{ listingId: string }>();
  const listing = useListing(listingId);

  if (!listing) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Listing not found.</ThemedText>
      </ThemedView>
    );
  }

  const { imageUris, title, description, category, events, size, pricePerDay } = listing;

  return (
    <ListingForm
      initial={{ imageUris, title, description, category, events, size, pricePerDay }}
      excludeId={listing.id}
      submitLabel="Save changes"
      onSubmit={async (values) => {
        await updateListing(listing.id, values);
        router.back();
      }}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

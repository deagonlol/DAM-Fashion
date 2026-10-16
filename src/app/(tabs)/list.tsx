import { router } from 'expo-router';

import { ListingForm } from '@/components/listing-form';
import { RestrictionBanner } from '@/components/restriction-banner';
import { createListing } from '@/lib/data/listings';

export default function ListItemScreen() {
  return (
    <ListingForm
      heading="List an item"
      submitLabel="Post listing"
      resetOnSubmit
      safeAreaTop
      banner={<RestrictionBanner />}
      onSubmit={async (values) => {
        const listing = await createListing(values);
        router.push(`/listing/${listing.id}`);
      }}
    />
  );
}

import { router, useLocalSearchParams } from 'expo-router';

import { ListingForm } from '@/components/listing-form';
import { RestrictionBanner } from '@/components/restriction-banner';
import { createListing } from '@/lib/data/listings';

/** A new listing. Opens blank as a new draft, or with `?draft=<id>` picks that draft back up. */
export default function ListItemScreen() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  return (
    <ListingForm
      key={draft ?? 'new'}
      draftId={draft}
      submitLabel="Post listing"
      resetOnSubmit
      banner={<RestrictionBanner />}
      onSubmit={async (values) => {
        const listing = await createListing(values);
        router.push(`/listing/${listing.id}`);
      }}
    />
  );
}

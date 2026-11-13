import { ListingGrid } from '@/components/listing-grid';
import { useSavedListings } from '@/hooks/use-saves';
import { useCurrentUser } from '@/hooks/use-session';

/** Every piece you've hearted, the "All saved" board in Closet. */
export default function SavedScreen() {
  const user = useCurrentUser();
  const saved = useSavedListings(user.id);
  return <ListingGrid listings={saved} emptyText="Tap the heart on any item to save it here." />;
}

/**
 * A half-filled new listing, kept on the device so leaving the form doesn't lose it. One draft
 * per signed-in user. Photos are kept as their local file links, which survive on the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ListingDraft = {
  imageUris: string[];
  title: string;
  description: string;
  category: string | null;
  events: string[];
  size: string | null;
  brand: string;
  measurements: string;
  fitNote: string;
  pickupSpots: string[];
  price: string;
  salePrice: string;
  offer: string;
};

const key = (userId: string) => `lendr.listing-draft.v1.${userId}`;

/** Whether the draft has anything worth keeping. */
export function isDraftEmpty(draft: ListingDraft) {
  return (
    draft.imageUris.length === 0 &&
    !draft.title.trim() &&
    !draft.description.trim() &&
    draft.category === null &&
    draft.events.length === 0 &&
    draft.size === null &&
    !draft.brand.trim() &&
    !draft.measurements.trim() &&
    !draft.fitNote.trim() &&
    draft.pickupSpots.length === 0 &&
    !draft.price.trim() &&
    !draft.salePrice.trim()
  );
}

export async function loadListingDraft(userId: string): Promise<ListingDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as ListingDraft) : null;
  } catch {
    return null;
  }
}

export async function saveListingDraft(userId: string, draft: ListingDraft) {
  try {
    if (isDraftEmpty(draft)) await AsyncStorage.removeItem(key(userId));
    else await AsyncStorage.setItem(key(userId), JSON.stringify(draft));
  } catch {
    // Drafts are a convenience; losing one isn't worth an error.
  }
}

export async function clearListingDraft(userId: string) {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Same as above.
  }
}

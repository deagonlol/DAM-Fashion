/**
 * Saved (liked) listings. The heart count on a listing is how many people saved it.
 * With Supabase this is a saves table with a unique (user_id, listing_id) pair.
 */
import { getCurrentUserId } from './session';
import { MOCK_SAVES } from './mock-data';
import { createStore } from './store';
import type { Save } from './types';

const savesStore = createStore<Save[]>(MOCK_SAVES);

export const subscribeToSaves = savesStore.subscribe;
export const getSavesSnapshot = savesStore.get;

/** Returns the saves with this user's save of the listing added or removed. */
export function toggleSaveIn(saves: Save[], userId: string, listingId: string, now: Date): Save[] {
  const isSaved = saves.some((save) => save.userId === userId && save.listingId === listingId);
  return isSaved
    ? saves.filter((save) => !(save.userId === userId && save.listingId === listingId))
    : [...saves, { userId, listingId, createdAt: now.toISOString() }];
}

export async function toggleSave(listingId: string) {
  savesStore.set(toggleSaveIn(savesStore.get(), getCurrentUserId(), listingId, new Date()));
}

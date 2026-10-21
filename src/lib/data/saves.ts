/**
 * Saved (liked) listings. The heart count on a listing is how many people saved it.
 * Who saved what is private, so the store only holds the signed-in user's saves, and the
 * counts come separately from the save_counts() database function.
 */
import { supabase } from '../supabase';
import { unwrap } from './rows';
import { getCurrentUserId } from './session';
import { createStore } from './store';
import type { Save } from './types';

const savesStore = createStore<Save[]>([]);
/** Listing id → number of saves, across everyone. */
const saveCountsStore = createStore<Record<string, number>>({});

export const subscribeToSaves = savesStore.subscribe;
export const getSavesSnapshot = savesStore.get;
export const subscribeToSaveCounts = saveCountsStore.subscribe;
export const getSaveCountsSnapshot = saveCountsStore.get;

export function setSaves(saves: Save[], counts: Record<string, number>) {
  savesStore.set(saves);
  saveCountsStore.set(counts);
}

/** Returns the saves with this user's save of the listing added or removed. */
export function toggleSaveIn(saves: Save[], userId: string, listingId: string, now: Date): Save[] {
  const isSaved = saves.some((save) => save.userId === userId && save.listingId === listingId);
  return isSaved
    ? saves.filter((save) => !(save.userId === userId && save.listingId === listingId))
    : [...saves, { userId, listingId, createdAt: now.toISOString() }];
}

export async function toggleSave(listingId: string) {
  const userId = getCurrentUserId();
  const wasSaved = savesStore.get().some((save) => save.userId === userId && save.listingId === listingId);
  if (wasSaved) {
    unwrap(await supabase.from('saves').delete().eq('user_id', userId).eq('listing_id', listingId));
  } else {
    unwrap(await supabase.from('saves').insert({ user_id: userId, listing_id: listingId }));
  }
  savesStore.set(toggleSaveIn(savesStore.get(), userId, listingId, new Date()));
  const counts = saveCountsStore.get();
  saveCountsStore.set({ ...counts, [listingId]: Math.max(0, (counts[listingId] ?? 0) + (wasSaved ? -1 : 1)) });
}

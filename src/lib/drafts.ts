/**
 * Half-filled new listings, kept on the device so leaving the form doesn't lose them. Each signed-in
 * user can have several, newest first. Photos are kept as their local file links, which survive on
 * the phone.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { createStore } from './data/store';

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

export type SavedDraft = ListingDraft & { id: string; updatedAt: string };

const key = (userId: string) => `lendr.listing-drafts.v2.${userId}`;
/** The one-draft key from before drafts could stack up; read once and folded in. */
const legacyKey = (userId: string) => `lendr.listing-draft.v1.${userId}`;

const draftsStore = createStore<SavedDraft[]>([]);
let loadedFor: string | null = null;
let loading: Promise<void> | null = null;

export function newDraftId() {
  return `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

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

/** Puts the draft first (it was just touched), or drops it if it's empty. */
export function withDraft(drafts: SavedDraft[], draft: SavedDraft) {
  const rest = drafts.filter((existing) => existing.id !== draft.id);
  return isDraftEmpty(draft) ? rest : [draft, ...rest];
}

function ensureLoaded(userId: string) {
  if (loadedFor === userId && loading) return loading;
  loadedFor = userId;
  draftsStore.set([]);
  loading = (async () => {
    try {
      const [raw, legacy] = await Promise.all([
        AsyncStorage.getItem(key(userId)),
        AsyncStorage.getItem(legacyKey(userId)),
      ]);
      let drafts: SavedDraft[] = raw ? (JSON.parse(raw) as SavedDraft[]) : [];
      if (legacy) {
        const old = JSON.parse(legacy) as ListingDraft;
        drafts = withDraft(drafts, { ...old, id: newDraftId(), updatedAt: new Date().toISOString() });
        await AsyncStorage.setItem(key(userId), JSON.stringify(drafts));
        await AsyncStorage.removeItem(legacyKey(userId));
      }
      if (loadedFor === userId) draftsStore.set(drafts);
    } catch {
      // Drafts are a convenience; losing them isn't worth an error.
    }
  })();
  return loading;
}

async function persist(userId: string, drafts: SavedDraft[]) {
  draftsStore.set(drafts);
  try {
    await AsyncStorage.setItem(key(userId), JSON.stringify(drafts));
  } catch {
    // Same as above.
  }
}

export async function loadListingDraft(userId: string, id: string): Promise<SavedDraft | null> {
  await ensureLoaded(userId);
  return draftsStore.get().find((draft) => draft.id === id) ?? null;
}

export async function saveListingDraft(userId: string, id: string, draft: ListingDraft) {
  await ensureLoaded(userId);
  await persist(userId, withDraft(draftsStore.get(), { ...draft, id, updatedAt: new Date().toISOString() }));
}

export async function deleteListingDraft(userId: string, id: string) {
  await ensureLoaded(userId);
  await persist(
    userId,
    draftsStore.get().filter((draft) => draft.id !== id)
  );
}

/** Every draft for this user, newest first. Updates as the form saves. */
export function useListingDrafts(userId: string) {
  useEffect(() => {
    void ensureLoaded(userId);
  }, [userId]);
  return useSyncExternalStore(draftsStore.subscribe, draftsStore.get, draftsStore.get);
}

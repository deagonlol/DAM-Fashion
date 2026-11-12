/**
 * Condition photos at pickup and return: either person can add a few, so damage disputes have
 * before-and-after proof. Private to the two people and the moderation team.
 */
import { supabase } from '../supabase';
import { uploadPrivatePhoto } from './photos';
import { toRentalPhoto, unwrap, type RentalPhotoRow } from './rows';
import { createStore, upsertById } from './store';
import { MAX_CONDITION_PHOTOS, type Rental, type RentalPhoto } from './types';

const rentalPhotosStore = createStore<RentalPhoto[]>([]);

export const subscribeToRentalPhotos = rentalPhotosStore.subscribe;
export const getRentalPhotosSnapshot = rentalPhotosStore.get;

export function setRentalPhotos(photos: RentalPhoto[]) {
  rentalPhotosStore.set(photos);
}

export function putRentalPhoto(photo: RentalPhoto) {
  rentalPhotosStore.set(upsertById(rentalPhotosStore.get(), photo));
}

export type PhotoStage = RentalPhoto['stage'];

/** Whether photos for this handoff can still be added: around pickup, or around the return. */
export function canAddConditionPhotos(rental: Rental, stage: PhotoStage) {
  return stage === 'pickup'
    ? rental.status === 'accepted' || rental.status === 'picked_up'
    : rental.status === 'picked_up' || rental.status === 'returned';
}

/** How many more photos this person can add at this handoff. */
export function photosLeft(photos: RentalPhoto[], rentalId: string, userId: string, stage: PhotoStage) {
  const mine = photos.filter(
    (photo) => photo.rentalId === rentalId && photo.uploaderId === userId && photo.stage === stage
  ).length;
  return Math.max(0, MAX_CONDITION_PHOTOS - mine);
}

/** Uploads photos and records them on the borrow. */
export async function addConditionPhotos(rental: Rental, userId: string, stage: PhotoStage, uris: string[]) {
  for (const uri of uris) {
    const path = await uploadPrivatePhoto('rental-photos', rental.id, userId, uri);
    const row: RentalPhotoRow = unwrap(
      await supabase
        .from('rental_photos')
        .insert({ rental_id: rental.id, uploader_id: userId, stage, path })
        .select()
        .single()
    );
    putRentalPhoto(toRentalPhoto(row));
  }
}

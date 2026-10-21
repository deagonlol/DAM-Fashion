/**
 * Photo uploads to Supabase Storage. Files go in the user's own folder, which the storage
 * policies require (see supabase/migrations/*_storage_buckets.sql).
 */
import { supabase } from '../supabase';
import { BackendError } from './rows';

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

/**
 * Uploads a local photo and returns its public URL. Photos that are already uploaded
 * (http URLs) are returned unchanged, so edit forms can pass a mix of old and new.
 */
export async function uploadPhoto(bucket: 'listing-photos' | 'avatars', userId: string, uri: string) {
  if (/^https?:\/\//.test(uri)) return uri;

  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension] ?? 'image/jpeg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension in CONTENT_TYPES ? extension : 'jpg'}`;
  const bytes = await (await fetch(uri)).arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType });
  if (error) throw new BackendError(`Couldn’t upload that photo. ${error.message}`);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Uploads photos in order, keeping already-uploaded ones as-is. */
export function uploadPhotos(bucket: 'listing-photos' | 'avatars', userId: string, uris: string[]) {
  return Promise.all(uris.map((uri) => uploadPhoto(bucket, userId, uri)));
}

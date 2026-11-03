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
  const path = await uploadFile(bucket, userId, uri);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

/** Uploads a local photo to the user's folder and returns its storage path. */
async function uploadFile(bucket: 'listing-photos' | 'avatars' | 'report-photos', userId: string, uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension] ?? 'image/jpeg';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension in CONTENT_TYPES ? extension : 'jpg'}`;
  const bytes = await (await fetch(uri)).arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType });
  if (error) throw new BackendError(`Couldn’t upload that photo. ${error.message}`);
  return path;
}

/** Uploads photos in order, keeping already-uploaded ones as-is. */
export function uploadPhotos(bucket: 'listing-photos' | 'avatars', userId: string, uris: string[]) {
  return Promise.all(uris.map((uri) => uploadPhoto(bucket, userId, uri)));
}

/** Uploads report proof photos to the private bucket and returns their storage paths. */
export function uploadReportPhotos(userId: string, uris: string[]) {
  return Promise.all(uris.map((uri) => uploadFile('report-photos', userId, uri)));
}

/** Short-lived links to view report photos. Only the reporter and the team are allowed. */
export async function reportPhotoUrls(paths: string[]) {
  if (paths.length === 0) return [];
  const { data, error } = await supabase.storage.from('report-photos').createSignedUrls(paths, 60 * 60);
  if (error) throw new BackendError(`Couldn’t load the report photos. ${error.message}`);
  return data.flatMap((item) => (item.signedUrl ? [item.signedUrl] : []));
}

/** Removes every photo in the user's own folders, before their account is deleted. */
export async function deleteAllPhotos(userId: string) {
  for (const bucket of ['listing-photos', 'avatars', 'report-photos'] as const) {
    const paths = await listFolder(bucket, userId);
    if (paths.length > 0) await supabase.storage.from(bucket).remove(paths);
  }
}

/** Every file under a folder. Listing photos sit one level deeper, in a folder per listing. */
async function listFolder(bucket: string, folder: string): Promise<string[]> {
  const { data } = await supabase.storage.from(bucket).list(folder, { limit: 1000 });
  const paths: string[] = [];
  for (const item of data ?? []) {
    const path = `${folder}/${item.name}`;
    // Folders come back without an id.
    if (item.id) paths.push(path);
    else paths.push(...(await listFolder(bucket, path)));
  }
  return paths;
}

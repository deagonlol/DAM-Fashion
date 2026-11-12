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

/** Private buckets: files are only visible to the people involved, through short-lived links. */
export type PrivateBucket = 'chat-photos' | 'rental-photos';

/**
 * Uploads a photo to `<folder>/<user id>/` in a private bucket and returns its storage path.
 * Chat photos go under the conversation, condition photos under the borrow.
 */
export async function uploadPrivatePhoto(bucket: PrivateBucket, folder: string, userId: string, uri: string) {
  const extension = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
  const contentType = CONTENT_TYPES[extension] ?? 'image/jpeg';
  const path = `${folder}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension in CONTENT_TYPES ? extension : 'jpg'}`;
  const bytes = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType });
  if (error) throw new BackendError(`Couldn’t upload that photo. ${error.message}`);
  return path;
}

const LINK_SECONDS = 60 * 60;
/** Signed links, reused until shortly before they expire so lists don't re-request them. */
const linkCache = new Map<string, { url: string; expiresAt: number }>();

/** Short-lived links to view private photos, in the same order as `paths`. Missing ones are null. */
export async function privatePhotoUrls(bucket: PrivateBucket, paths: string[]): Promise<(string | null)[]> {
  const now = Date.now();
  const fresh = (path: string) => {
    const cached = linkCache.get(`${bucket}/${path}`);
    return cached && cached.expiresAt > now + 60_000 ? cached.url : null;
  };
  const missing = paths.filter((path) => !fresh(path));
  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, LINK_SECONDS);
    if (error) throw new BackendError(`Couldn’t load the photos. ${error.message}`);
    for (const item of data) {
      if (item.path && item.signedUrl) {
        linkCache.set(`${bucket}/${item.path}`, { url: item.signedUrl, expiresAt: now + LINK_SECONDS * 1000 });
      }
    }
  }
  return paths.map((path) => fresh(path));
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

/**
 * Paths of the user's photos in chat and on borrows. Those sit under the conversation or borrow,
 * not the user's own folder, so they're found through the database. Call before the account
 * is deleted: the rows go with it.
 */
export async function ownPrivatePhotoPaths(userId: string) {
  const [messages, rentalPhotos] = await Promise.all([
    supabase.from('messages').select('image_path').eq('sender_id', userId).not('image_path', 'is', null),
    supabase.from('rental_photos').select('path').eq('uploader_id', userId),
  ]);
  return {
    'chat-photos': (messages.data ?? []).map((row: { image_path: string }) => row.image_path),
    'rental-photos': (rentalPhotos.data ?? []).map((row: { path: string }) => row.path),
  } satisfies Record<PrivateBucket, string[]>;
}

export async function removePrivatePhotos(paths: Record<PrivateBucket, string[]>) {
  for (const bucket of ['chat-photos', 'rental-photos'] as const) {
    if (paths[bucket].length > 0) await supabase.storage.from(bucket).remove(paths[bucket]);
  }
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

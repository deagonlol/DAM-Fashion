/**
 * Photo search: finds listings that look like a photo, using TinyCLIP image embeddings.
 * The model runs on the hosted TinyCLIP service (tinyclip-space/), so the phone only shrinks the
 * photo and uploads it. The service checks the user's Supabase session; the app holds no keys.
 */
import Constants from 'expo-constants';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '../supabase';
import type { Listing } from './types';

/** Set in app.json (expo.extra.tinyclipUrl). EXPO_PUBLIC_TINYCLIP_URL overrides it for local runs. */
export const TINYCLIP_URL = (
  process.env.EXPO_PUBLIC_TINYCLIP_URL ||
  (Constants.expoConfig?.extra?.tinyclipUrl as string | undefined) ||
  'http://localhost:7860'
).replace(/\/+$/, '');

/** Covers the free Render service waking up from sleep (up to about a minute). */
const TIMEOUT_MS = 75_000;
/** TinyCLIP looks at 224px, so a 384px photo keeps all the detail and uploads in a blink. */
const UPLOAD_WIDTH = 384;
/**
 * Which matches to show, in TinyCLIP cosine similarity. On the demo photos, the same kind of item
 * scores ~0.7-0.9 and unrelated items ~0.45-0.6, but a phone photo scores lower overall than a
 * product shot, so keep what's close to the best match rather than using one fixed cutoff.
 */
export const MIN_SIMILARITY = 0.5;
export const BEST_MATCH_WINDOW = 0.2;

export type PhotoMatch = { listingId: string; similarity: number };

export class ImageSearchError extends Error {}

/** Shrinks a picked photo to a small JPEG and returns it as base64. */
export async function preparePhoto(uri: string): Promise<string> {
  // Width only: the height follows the photo's shape. (Passing height: null breaks on web, where
  // it's read as 0.)
  const context = ImageManipulator.manipulate(uri).resize({ width: UPLOAD_WIDTH });
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!result.base64) throw new ImageSearchError('Could not read that photo.');
  return result.base64;
}

/** Wakes the service so it's ready by the time someone picks a photo. Never throws. */
export function warmUpImageSearch() {
  fetch(`${TINYCLIP_URL}/health`).catch(() => {});
}

/** Listings that look like the photo, closest first. Throws a message that is safe to show. */
export async function findSimilarListings(base64: string, count = 30): Promise<PhotoMatch[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ImageSearchError('Sign in to search by photo.');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${TINYCLIP_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ image_base64: base64, count }),
      signal: controller.signal,
    });
  } catch {
    throw new ImageSearchError(
      controller.signal.aborted
        ? 'Photo search is waking up. Try again in a few seconds.'
        : 'Couldn’t reach photo search. Check your connection.'
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) throw new ImageSearchError('Sign in to search by photo.');
  if (response.status === 400) throw new ImageSearchError('Couldn’t read that photo. Try another one.');
  if (!response.ok) throw new ImageSearchError('Photo search is waking up. Try again in a few seconds.');

  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new ImageSearchError('Photo search failed.');
  return body.filter(
    (match): match is PhotoMatch =>
      typeof match?.listingId === 'string' && typeof match?.similarity === 'number'
  );
}

/**
 * The listings that match, closest first. Listings the viewer can't see (already filtered out of
 * `listings`) stay out, and so do matches much weaker than the best one.
 */
export function rankByMatches(
  listings: Listing[],
  matches: PhotoMatch[],
  { minSimilarity = MIN_SIMILARITY, window = BEST_MATCH_WINDOW } = {}
) {
  const byId = new Map(listings.map((listing) => [listing.id, listing]));
  const visible = matches
    .filter((match) => byId.has(match.listingId))
    .sort((a, b) => b.similarity - a.similarity);
  const best = visible[0]?.similarity ?? 0;
  const floor = Math.max(minSimilarity, best - window);
  return visible.filter((match) => match.similarity >= floor).map((match) => byId.get(match.listingId)!);
}

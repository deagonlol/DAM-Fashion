import { useEffect, useState } from 'react';

import { privatePhotoUrls, type PrivateBucket } from '@/lib/data/photos';

/**
 * Viewable links for photos in a private bucket, in the same order as `paths`. Each is null
 * until its link loads, or if the viewer isn't allowed to see it.
 */
export function usePrivatePhotoUrls(bucket: PrivateBucket, paths: string[]) {
  const key = paths.join('|');
  const [urls, setUrls] = useState<{ key: string; urls: (string | null)[] }>({ key: '', urls: [] });

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    privatePhotoUrls(bucket, key.split('|'))
      .then((loaded) => {
        if (!cancelled) setUrls({ key, urls: loaded });
      })
      .catch(() => {
        if (!cancelled) setUrls({ key, urls: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, key]);

  return urls.key === key ? urls.urls : paths.map(() => null);
}

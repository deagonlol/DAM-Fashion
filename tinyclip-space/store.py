"""Reads listings and writes embeddings with the service role key. Shared by the API and backfill."""
import os
import time

import httpx
from supabase import Client, create_client

from model import TinyClip


def supabase_admin() -> Client:
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


USER_AGENT = "LendrPhotoIndexer/1.0 (https://github.com/deagonlol/DAM-Fashion)"


def download(uri: str, client: httpx.Client, attempts: int = 4) -> bytes:
    """Fetches a photo. Image hosts like Wikimedia rate-limit bursts, so 429s and 5xxs are retried."""
    for attempt in range(attempts):
        response = client.get(uri, follow_redirects=True, timeout=30, headers={"User-Agent": USER_AGENT})
        if response.status_code == 429 or response.status_code >= 500:
            retry_after = response.headers.get("retry-after", "")
            time.sleep(float(retry_after) if retry_after.isdigit() else 2 ** attempt)
            continue
        response.raise_for_status()
        if not response.headers.get("content-type", "").startswith("image/"):
            raise ValueError(f"not an image ({response.headers.get('content-type')})")
        return response.content
    raise ValueError(f"gave up after {attempts} tries (HTTP {response.status_code})")


def index_listing(db: Client, clip: TinyClip, listing_id: str, http: httpx.Client) -> dict:
    """Embeds the listing's photos that aren't indexed yet and drops rows for photos it no longer has."""
    rows = db.table("listings").select("id, image_uris").eq("id", listing_id).limit(1).execute().data
    if not rows:
        db.table("listing_photo_embeddings").delete().eq("listing_id", listing_id).execute()
        return {"indexed": 0, "removed": "all"}
    uris: list[str] = rows[0]["image_uris"] or []

    existing = (
        db.table("listing_photo_embeddings")
        .select("image_uri, model")
        .eq("listing_id", listing_id)
        .execute()
        .data
    )
    current = {row["image_uri"] for row in existing if row["model"] == clip.name}
    stale = [row["image_uri"] for row in existing if row["image_uri"] not in uris]
    if stale:
        db.table("listing_photo_embeddings").delete().eq("listing_id", listing_id).in_("image_uri", stale).execute()

    upserts, failed = [], []
    for uri in uris:
        if uri in current:
            continue
        try:
            embedding = clip.embed_bytes(download(uri, http))
        except Exception as error:  # A broken photo shouldn't stop the rest.
            failed.append({"uri": uri, "error": str(error)[:200]})
            continue
        upserts.append({"listing_id": listing_id, "image_uri": uri, "embedding": embedding, "model": clip.name})
    if upserts:
        db.table("listing_photo_embeddings").upsert(upserts).execute()
    return {"indexed": len(upserts), "removed": len(stale), "failed": failed}

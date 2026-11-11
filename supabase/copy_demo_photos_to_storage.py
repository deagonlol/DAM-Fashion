"""
Copies every listing photo that is still an outside link (the Wikimedia demo photos) into the
listing-photos bucket, under the seller's own folder like an app upload:

    listing-photos/<owner id>/<listing id>/<n>.jpg

then points the listing at the stored copy. Photos already in storage are left alone, so it's safe
to re-run, e.g. after running supabase/demo_*.sql again.

Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, read from tinyclip-space/.env (or the environment).
Uses the tinyclip-space virtualenv, which already has the packages:

    tinyclip-space/.venv/bin/python supabase/copy_demo_photos_to_storage.py [--dry-run]
"""
import os
import sys
import time
from pathlib import Path

import httpx
from supabase import create_client

BUCKET = "listing-photos"
USER_AGENT = "LendrDemoData/1.0 (https://github.com/deagonlol/DAM-Fashion)"
CONTENT_TYPES = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def load_env():
    env_file = Path(__file__).resolve().parent.parent / "tinyclip-space" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())
    missing = [key for key in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") if not os.environ.get(key)]
    if missing:
        sys.exit(f"Missing {', '.join(missing)}. Add them to tinyclip-space/.env (see .env.example).")


def download(uri: str, http: httpx.Client) -> tuple[bytes, str]:
    """Fetches a photo, backing off when the host rate-limits."""
    for attempt in range(5):
        response = http.get(uri, follow_redirects=True, timeout=30, headers={"User-Agent": USER_AGENT})
        if response.status_code == 429 or response.status_code >= 500:
            time.sleep(2 ** attempt)
            continue
        response.raise_for_status()
        content_type = response.headers.get("content-type", "").split(";")[0]
        if content_type not in CONTENT_TYPES.values():
            raise ValueError(f"not a supported image ({content_type})")
        return response.content, content_type
    raise ValueError(f"gave up (HTTP {response.status_code})")


def main():
    dry_run = "--dry-run" in sys.argv
    load_env()
    db = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    storage_prefix = f"{os.environ['SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/"

    listings = db.table("listings").select("id, owner_id, title, image_uris").is_("deleted_at", "null").execute().data
    todo = [row for row in listings if any(not uri.startswith(storage_prefix) for uri in row["image_uris"])]
    print(f"{len(todo)} of {len(listings)} listings have photos outside storage.")

    copied = failed = 0
    with httpx.Client() as http:
        for row in todo:
            new_uris = []
            for n, uri in enumerate(row["image_uris"], 1):
                if uri.startswith(storage_prefix):
                    new_uris.append(uri)
                    continue
                if dry_run:
                    print(f"  would copy {row['title']}: {uri}")
                    new_uris.append(uri)
                    continue
                try:
                    data, content_type = download(uri, http)
                except Exception as error:
                    print(f"  ! {row['title']}: {uri} ({error})")
                    new_uris.append(uri)  # Keep the working link rather than lose the photo.
                    failed += 1
                    continue
                extension = next(ext for ext, kind in CONTENT_TYPES.items() if kind == content_type and ext != "jpeg")
                path = f"{row['owner_id']}/{row['id']}/{n}.{extension}"
                db.storage.from_(BUCKET).upload(
                    path, data, {"content-type": content_type, "upsert": "true", "cache-control": "31536000"}
                )
                new_uris.append(db.storage.from_(BUCKET).get_public_url(path).rstrip("?"))
                copied += 1
                time.sleep(0.5)  # Be gentle with Wikimedia.
            if not dry_run and new_uris != row["image_uris"]:
                db.table("listings").update({"image_uris": new_uris}).eq("id", row["id"]).execute()
                print(f"  ✓ {row['title']}")

    print(f"Done. Copied {copied} photos" + (f", {failed} failed (still linked)." if failed else "."))


if __name__ == "__main__":
    main()

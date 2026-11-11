"""
Indexes every listing's photos. Run once after the migration, and again after changing photos in bulk
(e.g. supabase/demo_photos*.sql) or switching TINYCLIP_MODEL. Already-indexed photos are skipped.

    python backfill.py
"""
import os
from pathlib import Path

import httpx

if Path(".env").exists():
    for line in Path(".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())

from model import TinyClip  # noqa: E402
from store import index_listing, supabase_admin  # noqa: E402


def main():
    db = supabase_admin()
    clip = TinyClip()
    ids, start, page = [], 0, 500
    while True:
        rows = db.table("listings").select("id").is_("deleted_at", "null").range(start, start + page - 1).execute().data
        ids += [row["id"] for row in rows]
        if len(rows) < page:
            break
        start += page

    total, failures = 0, 0
    with httpx.Client() as http:
        for number, listing_id in enumerate(ids, 1):
            result = index_listing(db, clip, listing_id, http)
            total += result["indexed"]
            for failure in result.get("failed", []):
                failures += 1
                print(f"  ! {listing_id} {failure['uri']}: {failure['error']}")
            print(f"[{number}/{len(ids)}] {listing_id}: +{result['indexed']}")
    print(f"Done. Embedded {total} new photos across {len(ids)} listings ({failures} failed).")


if __name__ == "__main__":
    main()

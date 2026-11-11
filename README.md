# Lendr

Borrow and lend clothes with other UT Austin students: game day fits, formals, costumes, career fair outfits. Built by a Texas Convergent team.

> "Lendr" is the working name. The repo and some internal names still say DAM Fashion.

## Features

- **UT-only accounts:** sign-up needs a confirmed `@utexas.edu` email.
- **Browse and search:** filter by type, event, size and price. Smart search understands typed queries like "black formal dress under $15". You can also search by photo: take or pick a picture and see the listings that look most like it.
- **Listings:** multiple photos, a daily price, an optional buy price, and an availability calendar the owner can block days on.
- **Borrowing:** request dates and a pickup spot and offer a daily price. The lender accepts or declines, and pickup and return are confirmed with codes. Late returns are tracked.
- **Buying:** request to buy a listing outright. Accepting marks it sold.
- **Chat:** one conversation per listing.
- **Profiles:** reviews and replies, badges, and a closet of saved items.
- **Safety:** report users, listings or individual messages, with photo proof. Block users. Strikes lead to a warning, then a 7-day limit, then a ban. The team reviews reports in an admin queue.
- **Account:** password reset and account deletion.

## Tech stack

| | |
|---|---|
| App | [Expo](https://docs.expo.dev/versions/v57.0.0/) SDK 57, React Native, TypeScript |
| Navigation | [Expo Router](https://docs.expo.dev/router/introduction/) (file-based, in `src/app/`) |
| Backend | [Supabase](https://supabase.com): Postgres with row-level security, Auth, Storage, Realtime |
| Photo search | [TinyCLIP](https://huggingface.co/wkcn/TinyCLIP-ViT-39M-16-Text-19M-YFCC15M) image embeddings, run by a small service on [Render](https://render.com) (`tinyclip-space/`), matched with pgvector in Supabase |
| Tests | Jest (`jest-expo`) |

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment variables

Create `.env.local` in the project root. It's ignored by git.

```bash
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key>

# Optional: use a TinyCLIP service other than the one in app.json (expo.extra.tinyclipUrl),
# e.g. one running on your computer.
# EXPO_PUBLIC_TINYCLIP_URL=http://localhost:7860
```

Both Supabase values are on the Supabase dashboard under **Connect**. Ask a teammate for access to the project.

### 3. Database (new Supabase project only)

Run each file in `supabase/migrations/` **in order**, **once**, in the Supabase SQL Editor. Then run `supabase/seed.sql` for test data. The shared project already has all of this, so skip this step unless you're setting up your own.

The test data's dates are relative to the day it was seeded, so they go stale. Before a demo, run `supabase/refresh_demo_dates.sql` in the SQL Editor to move them up to today. It's safe to run any time.

More one-off demo scripts live next to it: `demo_brands_and_spots.sql` (brands and lender pickup spots), `demo_photos.sql` / `demo_photos_2.sql` (real clothing photos from Wikimedia Commons, credited in `photo_credits.md`), and `demo_listings_thrift.sql` (13 more thrift-style listings). Those scripts link to Wikimedia; afterwards run `tinyclip-space/.venv/bin/python supabase/copy_demo_photos_to_storage.py` to copy the photos into the `listing-photos` bucket (needs the service-role key in `tinyclip-space/.env`).

### 4. Run

```bash
npm run web        # browser
npm run ios        # iOS simulator (needs Xcode)
npm run android    # Android emulator
npm start          # dev server; scan the QR code with Expo Go
```

**Test account:** `alex.damtest@utexas.edu` / `damfashion`, or tap **Skip login**. The other seeded accounts are listed at the top of `supabase/seed.sql`.

### Photo search

Users don't set anything up: the app sends a small copy of the photo, with their sign-in, to the hosted
TinyCLIP service, which returns the closest listings. The service holds the Supabase service-role key; the
app holds no keys.

How it fits together:

1. Every listing photo has a 512-number TinyCLIP embedding in `listing_photo_embeddings`
   (`supabase/migrations/20261106000000_tinyclip_photo_search.sql`).
2. When a listing is created or its photos change, a database trigger asks the service to index it.
3. A search embeds the user's photo and finds the nearest listings with `match_listing_photos`.
   The app ranks them in `src/lib/data/image-search.ts`.

**One-time setup (the team does this once, not each user):**

1. Run the migration above in the SQL Editor.
2. Deploy the service on Render (free): **New → Blueprint**, pick this repo; it reads `render.yaml`.
   Enter `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `INDEX_SECRET` (any long random string) when asked.
   The first build takes ~10 minutes (it exports the model to ONNX).
3. Put the service's URL (`https://lendr-tinyclip.onrender.com` or similar) in `app.json` →
   `expo.extra.tinyclipUrl`.
4. Store the same URL and secret in Vault so new listings get indexed (SQL Editor):
   ```sql
   select vault.create_secret('https://<service>.onrender.com', 'tinyclip_url');
   select vault.create_secret('<INDEX_SECRET>', 'tinyclip_index_secret');
   ```
5. Index the existing listings, from your computer (needs PyTorch once, to export the model):
   ```bash
   cd tinyclip-space && python3 -m venv .venv
   .venv/bin/pip install -r requirements.txt -r requirements-export.txt
   .venv/bin/python export_onnx.py
   cp .env.example .env   # fill in the values
   .venv/bin/python backfill.py
   ```
   Run `backfill.py` again after bulk photo changes like `demo_photos*.sql`. It skips photos already indexed.

A free Render service sleeps after 15 minutes without use. The search screen wakes it when it opens, and the
first search after a nap can take up to about a minute. To run the service locally instead, run
`.venv/bin/uvicorn app:app --host 0.0.0.0 --port 7860` in `tinyclip-space/` and set `EXPO_PUBLIC_TINYCLIP_URL`
(use your computer's local IP address from a phone on the same network).

## Before you push

```bash
npx tsc --noEmit   # typecheck
npm run lint
npm test
```

## Project structure

```
src/
  app/              Screens. Every file is a route (Expo Router).
    (tabs)/         Home, Inbox, Closet, Orders
    _layout.tsx     Root stack and the signed-in / signed-out guard
  components/       Shared UI (cards, forms, calendar, buttons…)
  hooks/            React hooks over the data stores
  lib/
    supabase.ts     Supabase client
    data/           All app logic: one file per area (rentals, sales, listings,
                    moderation, search, auth…). Rules are pure functions with
                    tests in data/__tests__/. The async functions save to Supabase.
  constants/
    theme.ts        Colors and fonts (from the team Figma)
tinyclip-space/     TinyCLIP photo search service (Docker, deployed on Render via render.yaml)
supabase/
  migrations/       Database schema, policies and functions, in run order
  seed.sql          Test accounts and listings
```

The database also enforces the app's rules, such as who can accept a borrow, strikes and blocks. When you change a rule in `src/lib/data/`, check whether the matching SQL function in `supabase/migrations/` needs the same change.

## Working together

- **Tasks:** [Linear](https://linear.app/dam-fashion), on the **Tech** team (`TEC-*`).
- **Designs:** the [Wireframes](https://www.figma.com/design/nY5wtwPCkdtW4VrOEpdci4/Wireframes) file in Figma.
- **Branches:** branch off `main` and open a pull request. Don't commit straight to `main`.
- **Database changes:** add a new, dated file to `supabase/migrations/`. Don't edit old migrations, since they've already been run on the shared project.
- **Native folders:** `ios/` and `android/` are generated, so don't create or edit them. Configure native behavior in `app.json`.

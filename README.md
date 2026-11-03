# Lendr

Borrow and lend clothes with other UT Austin students: game day fits, formals, costumes, career fair outfits. Built by a Texas Convergent team.

> "Lendr" is the working name. The repo and some internal names still say DAM Fashion.

## Features

- **UT-only accounts:** sign-up needs a confirmed `@utexas.edu` email.
- **Browse and search:** filter by type, event, size and price. Smart search understands typed queries like "black formal dress under $15". You can also search by photo.
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
| Photo search | Any OpenAI-compatible vision API. Defaults to [Ollama](https://ollama.com) running `qwen2.5vl:3b` locally. |
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

# Optional: photo search. Defaults shown.
# EXPO_PUBLIC_VISION_URL=http://localhost:11434
# EXPO_PUBLIC_VISION_MODEL=qwen2.5vl:3b
```

Both Supabase values are on the Supabase dashboard under **Connect**. Ask a teammate for access to the project.

### 3. Database (new Supabase project only)

Run each file in `supabase/migrations/` **in order**, **once**, in the Supabase SQL Editor. Then run `supabase/seed.sql` for test data. The shared project already has all of this, so skip this step unless you're setting up your own.

The test data's dates are relative to the day it was seeded, so they go stale. Before a demo, run `supabase/refresh_demo_dates.sql` in the SQL Editor to move them up to today. It's safe to run any time.

Two more one-off demo scripts live next to it: `demo_brands_and_spots.sql` (brands and lender pickup spots) and `demo_photos.sql` (real clothing photos from Wikimedia Commons, credited in `photo_credits.md`).

### 4. Run

```bash
npm run web        # browser
npm run ios        # iOS simulator (needs Xcode)
npm run android    # Android emulator
npm start          # dev server; scan the QR code with Expo Go
```

**Test account:** `alex.damtest@utexas.edu` / `damfashion`, or tap **Skip login**. The other seeded accounts are listed at the top of `supabase/seed.sql`.

### Photo search (optional)

```bash
brew install ollama
ollama pull qwen2.5vl:3b
ollama serve
```

The first search after starting Ollama takes about 20 seconds while the model loads. To use photo search from a phone, start Ollama with `OLLAMA_HOST=0.0.0.0 ollama serve` and set `EXPO_PUBLIC_VISION_URL` to your computer's local IP address.

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

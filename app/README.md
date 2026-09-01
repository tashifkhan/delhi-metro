# Delhi + Noida Metro App

Expo + React Native app for planning journeys on Delhi Metro and Noida Metro
from one persistent network selector. Builds for iOS, Android, and the web —
the site is live at https://ncr-metro.tashif.codes.

## Features

- Journey planner with strategy toggle:
  - least-distance
  - minimum-interchange
- First/last train timing details
- Station search and station detail screens
- Metro lines explorer with line station lists
- High-resolution interactive network maps with zoom and direct Photos/Gallery saving
- Notifications feed
- Local SQLite-backed popular route cache (`localStorage` on web)
- Noida Aqua Line route/fare/distance planning and first/last trains
- NMRC stations, line view, network map, and press-release archive
- Separate offline station and route caches for each network

## Tech Stack

- Expo SDK 54
- React Native 0.81 + React 19
- TypeScript
- React Navigation
- TanStack React Query
- react-native-paper
- expo-sqlite, expo-file-system, expo-media-library
- react-native-web + Cloudflare Workers for the web target

## Prerequisites

- Node.js 20+ recommended
- Bun installed
- iOS Simulator / Android Emulator (or physical device)
- Running backend API compatible with `/api/v1/dmrc/*` routes

## Setup

```bash
cd app
bun install
```

Create `app/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Run

```bash
cd app
bun run start
```

Shortcuts:

- `bun run android`
- `bun run ios`
- `bun run web`

## Web

The web build is hosted on Cloudflare Workers, which also reverse-proxies
`/api/*` to the backend so the browser talks to a single origin.

```bash
bun run build:web     # export to dist/
bun run preview:web   # the real Worker on localhost:8787
bun run deploy:web    # export + wrangler deploy
```

Modules with no meaningful web behaviour have `.web.ts` variants: the storage
repositories persist to `localStorage` instead of SQLite, and the map saves
through a browser download instead of `expo-media-library`.

## Build and release

This project includes an EAS profile for APK release:

- Profile name: `github-release`
- File: `app/eas.json`

## Architecture Notes

- API base URL is resolved in `src/config/env.ts`.
- Network calls are centralized in `src/api/client.ts` and service modules.
- Query hooks live in `src/hooks/`.
- App-level dependency injection is wired through `src/di/`.
- Local persistence uses SQLite (`src/storage/`), or `localStorage` on web.

## Useful Paths

- App entry: `app/App.tsx`
- Navigation: `app/src/navigation/`
- Screens: `app/src/screens/`
- Services: `app/src/services/`
- Types: `app/src/types/`

## Related docs

- Mobile deep-dive: `docs/expo-app-guide.md`
- API backend docs: `docs/api-backend-guide.md`

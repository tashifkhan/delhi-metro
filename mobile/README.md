# Delhi Metro Mobile App

Expo + React Native app for planning Delhi Metro journeys, browsing lines/stations, viewing network maps, and checking alerts.

## Features

- Journey planner with strategy toggle:
  - least-distance
  - minimum-interchange
- First/last train timing details
- Station search and station detail screens
- Metro lines explorer with line station lists
- Interactive network map view with zoom and PDF share
- Notifications feed
- Local SQLite-backed popular route cache

## Tech Stack

- Expo SDK 54
- React Native 0.81 + React 19
- TypeScript
- React Navigation
- TanStack React Query
- react-native-paper
- expo-sqlite, expo-file-system, expo-sharing

## Prerequisites

- Node.js 20+ recommended
- Bun installed
- iOS Simulator / Android Emulator (or physical device)
- Running backend API compatible with `/api/v1/dmrc/*` routes

## Setup

```bash
cd mobile
bun install
```

Create `mobile/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

## Run

```bash
cd mobile
bun run start
```

Shortcuts:

- `bun run android`
- `bun run ios`
- `bun run web`

## Build and Release

This project includes an EAS profile for APK release:

- Profile name: `github-release`
- File: `mobile/eas.json`

See full release instructions in:

- `docs/expo-apk-release-guide.md`

## Architecture Notes

- API base URL is resolved in `src/config/env.ts`.
- Network calls are centralized in `src/api/client.ts` and service modules.
- Query hooks live in `src/hooks/`.
- App-level dependency injection is wired through `src/di/`.
- Local persistence uses SQLite (`src/storage/`).

## Useful Paths

- App entry: `mobile/App.tsx`
- Navigation: `mobile/src/navigation/`
- Screens: `mobile/src/screens/`
- Services: `mobile/src/services/`
- Types: `mobile/src/types/`

## Related Docs

- Mobile deep-dive: `docs/expo-app-guide.md`
- API backend docs: `docs/api-backend-guide.md`

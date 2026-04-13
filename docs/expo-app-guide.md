# Expo Mobile App Guide

This document explains the Expo React Native app in this repository: architecture, setup, environment configuration, and how it integrates with the API.

## Overview

The mobile app lives in `mobile/` and provides Delhi Metro user flows for:

- Journey planning
- Station search and details
- Metro line browsing
- Network map viewing and PDF sharing
- Alert/notification feed
- Lightweight local caching of popular routes

## Tech Stack

- Expo SDK 54
- React Native 0.81 + React 19
- React Navigation (stack + bottom tabs)
- TanStack React Query
- react-native-paper (UI components + theming)
- expo-sqlite (local cache)
- expo-file-system + expo-sharing (map PDF download/share)
- TypeScript

## App Structure

Key files and folders in `mobile/`:

- `App.tsx`: app providers and root composition
- `src/navigation/`: tab + stack navigators and route param types
- `src/screens/`: feature screens (home, search, lines, maps, alerts)
- `src/components/`: reusable UI components
- `src/hooks/`: React Query hooks and helper hooks
- `src/services/`: DMRC and map API service layer
- `src/api/`: API client, errors, query client
- `src/storage/`: SQLite setup and popular route repository
- `src/theme/`: theme primitives and theme context
- `src/types/`: API and app data types
- `src/config/env.ts`: environment variable mapping

## Runtime Flow

1. App bootstraps providers in `App.tsx`:
   - `SafeAreaProvider`
   - `ThemeProvider`
   - `DIProvider`
   - `QueryClientProvider`
2. `RootTabs` mounts feature stacks:
   - Plan (home)
   - Search
   - Lines
   - Map
   - Alerts
3. Screens use typed hooks in `src/hooks/`.
4. Hooks call service methods in `src/services/`.
5. Services call typed API client against backend `/api/v1`.
6. Popular journey plans can be cached and reused from SQLite.

## Environment Configuration

The app reads backend base URL from `EXPO_PUBLIC_API_BASE_URL`:

- Source: `mobile/src/config/env.ts`
- Fallback: `http://localhost:8000/api/v1`

Example local `.env` in `mobile/`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

For production EAS builds, configure this in Expo project environments instead of hardcoding values.

## Local Development

From repository root:

```bash
cd mobile
bun install
bun run start
```

Other scripts:

- `bun run android`
- `bun run ios`
- `bun run web`

## API Integration

The app expects the backend routes under `/dmrc/*` on top of `apiBaseUrl`.

Primary calls from mobile service layer:

- `GET /dmrc/lines`
- `GET /dmrc/notifications`
- `GET /dmrc/stations/search`
- `GET /dmrc/lines/{line_code}/stations`
- `GET /dmrc/stations/{station_code}`
- `GET /dmrc/journeys/fare-route`
- `GET /dmrc/journeys/first-last-train`
- `GET /dmrc/journeys/complete`
- `GET /dmrc/maps/{family}` and related map routes

If the API base URL is unreachable, user-facing screens show error states with retry.

## Data and Caching Strategy

- React Query handles request lifecycle, caching, retries, and stale control.
- A SQLite table (`popular_routes`) stores successful journey plans by route key.
- For non-timed journeys, app attempts network first, then falls back to local cached plan.
- Popular routes are surfaced on the Home screen with hit counts.

SQLite schema is created automatically in `src/storage/database.ts`.

## Screen-Level Feature Map

- `HomeScreen`
  - Station pickers for source/destination
  - Optional departure offset chips (`Now`, `+15m`, `+30m`, `+1h`)
  - Navigate to journey results
  - Popular routes and recent notifications

- `JourneyResultsScreen`
  - Combined journey payload via `/journeys/complete`
  - Strategy toggle (`least-distance` / `minimum-interchange`)
  - Fare summary, route segments, first/last train details

- `StationSearchScreen`
  - Debounced station search
  - Empty/loading states
  - Navigate to station detail

- `MetroLinesScreen` and line station screens
  - List lines and station sequence per selected line

- `MetroMapScreen`
  - Fetches primary network map asset
  - Pinch/pan/double-tap zoom interactions
  - Downloads and shares map PDF when available

- `NotificationsScreen`
  - Passenger alert cards

## Build and Release

Current EAS profile:

- File: `mobile/eas.json`
- Profile: `github-release`
- Android build type: APK
- Channel: production
- Auto version increment enabled

Use the dedicated release guide for full steps:

- `docs/expo-apk-release-guide.md`

## Common Setup Issues

- API requests failing locally:
  - Ensure backend is running and `EXPO_PUBLIC_API_BASE_URL` points to `/api/v1`.
- Emulator/device cannot reach localhost:
  - Use machine LAN IP or proper emulator host mapping.
- Empty map PDF state:
  - Some map families may not currently expose PDF assets upstream.
- Build-time env missing:
  - Ensure EAS environment variables are configured for `production`.

## Security and Ops Notes

- Do not commit secrets in app config or source.
- Only `EXPO_PUBLIC_*` values are intended for client-side exposure.
- Keep backend URL and app versioning consistent across releases.

## Related Docs

- API backend details: `docs/api-backend-guide.md`
- API reverse-engineering notes: `docs/DMRC_API_FLOW.md`
- APK release process: `docs/expo-apk-release-guide.md`

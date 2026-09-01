# Expo mobile app guide

This is the guide for the app in `mobile/`. If you want to run it, shape its navigation, or understand how it talks to the API, start here.

I wanted the app to feel fast on a crowded train. Pick two stations, see both route options, and keep working when the network flickers. Delhi NCR has two operators, so the app also remembers which network you chose and keeps its data separate.

## Overview

The app lives in `mobile/` and covers the core commuter flows:

- journey planning with fare and route
- station search and station detail
- line browsing and per line station lists
- the big network map with pinch, pan, and PDF sharing
- the alerts feed

It also caches popular journeys locally so repeat trips do not always need the network.

## Tech stack

- Expo SDK 54
- React Native 0.81 and React 19
- React Navigation with a stack inside bottom tabs
- TanStack React Query
- react-native-paper for UI and theming
- expo-sqlite for local caching
- expo-file-system and expo-sharing for map PDF download and sharing
- TypeScript

Same approach as the backend. Keep the stack predictable and let the app code handle the interesting parts.

## App structure

Key files and folders in `mobile/`:

- `App.tsx` composes the providers and the root
- `src/navigation/` holds tab and stack navigators plus route param types
- `src/screens/` has feature screens for home, search, lines, maps, and alerts
- `src/components/` has reusable UI pieces
- `src/hooks/` has React Query hooks and small helper hooks
- `src/services/` is the DMRC and map service layer
- `src/api/` has the typed API client, error handling, and the query client
- `src/storage/` has SQLite setup and the popular route repository
- `src/theme/` has theme primitives and the theme context
- `src/types/` has API and app data types
- `src/config/env.ts` maps env vars to app config

## Runtime flow

1. `App.tsx` boots providers in order, `SafeAreaProvider`, `ThemeProvider`, `DIProvider`, then `QueryClientProvider`.
2. `RootTabs` mounts the feature stacks, Plan for home, Search, Lines, Map, Alerts.
3. Screens call typed hooks from `src/hooks/`.
4. Hooks call service methods in `src/services/`.
5. Services call the typed API client against the backend under `/api/v1`.
6. For popular routes, successful journey plans get cached in SQLite and reused.

That layering is on purpose. Screens stay simple, hooks own the async state, services own the endpoint shape.

## Environment configuration

The app gets the backend base URL from `EXPO_PUBLIC_API_BASE_URL`:

- read in `mobile/src/config/env.ts`
- fallback is `http://localhost:8000/api/v1`

Create `mobile/.env` for local dev:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

For production EAS builds, set the same var in the Expo project environment instead of committing it. That keeps local and prod configs separate and avoids leaking prod hosts into the repo.

## Local development

From the repo root:

```bash
cd mobile
bun install
bun run start
```

Other scripts you will actually use:

- `bun run android`
- `bun run ios`
- `bun run web`

## API integration

The app expects backend routes under `/dmrc/*` appended to `apiBaseUrl`. The v1 NMRC routes mirror the same shapes at `/nmrc/*`.

Main calls from the mobile service layer:

- `GET /dmrc/lines`
- `GET /dmrc/notifications`
- `GET /dmrc/stations/search`
- `GET /dmrc/lines/{line_code}/stations`
- `GET /dmrc/stations/{station_code}`
- `GET /dmrc/journeys/fare-route`
- `GET /dmrc/journeys/first-last-train`
- `GET /dmrc/journeys/complete`
- `GET /dmrc/maps/{family}` and the related map asset and file routes

If the base URL is wrong or the API is down, screens show an error state with a retry. I did not want spinners that never resolve.

## Data and caching strategy

- React Query owns request lifecycle, caching, retries, and staleness. It is the main cache.
- A SQLite table called `popular_routes` stores successful journey plans by route key, so the app has something to show when the network is spotty.
- For journeys without a specific `journey_time`, the app tries the network first and falls back to the cached plan.
- Popular routes show on Home with a hit count so repeat trips are one tap.

The SQLite schema is created automatically in `src/storage/database.ts`. You do not need to run migrations by hand.

## Screen level feature map

- `HomeScreen`
  - pickers for source and destination stations
  - departure offset chips for `Now`, `+15m`, `+30m`, `+1h` that set `journey_time` for you
  - button to view journey results
  - popular routes and recent notifications on the same screen

- `JourneyResultsScreen`
  - fetches the combined payload via `/journeys/complete`
  - toggle between `least-distance` and `minimum-interchange`
  - shows fare summary, route segments, and first and last train details for the chosen strategy

- `StationSearchScreen`
  - debounced search input so you are not firing on every keystroke
  - empty and loading states that actually explain what happened
  - tap to open station detail

- `MetroLinesScreen` and per line screens
  - list every line, then show the ordered station sequence for the selected line
  - interchange stations are marked so you can spot changes at a glance

- `MetroMapScreen`
  - loads the primary network map asset for the current network
  - supports pinch, pan, and double tap zoom
  - downloads and shares the map PDF when the upstream has one

- `NotificationsScreen`
  - renders passenger alert cards from the notifications feed

## Build and release

Current EAS setup:

- file is `mobile/eas.json`
- profile is `github-release`
- Android build type is APK
- channel is `production`
- auto version increment is on

## Common setup issues

- API requests fail locally
  - Check that the API is running and `EXPO_PUBLIC_API_BASE_URL` ends with `/api/v1`. A missing prefix is the most common mistake.

- Emulator or device cannot reach localhost
  - Use your machine LAN IP or the emulator host mapping. `localhost` inside the emulator is not your laptop.

- Map PDF is empty for a family
  - Some families do not currently have a PDF upstream. The API returns an empty list or null in that case. That is expected.

- Build time env missing
  - Make sure EAS environment variables are set for `production`. Client builds only see `EXPO_PUBLIC_*` values.

## Security and ops notes

- Do not commit secrets in app config or source. I know it is tempting to paste a prod URL and move on.
- Only `EXPO_PUBLIC_*` values are exposed to the client build. Anything else stays on the server side.
- Keep the backend URL and the app version in sync across releases so users do not hit a stale contract.

## Related docs

- API backend details at `docs/api-backend-guide.md`
- DMRC API flow notes at `docs/dmrc-api-flow.md`

# Changelog

All notable changes to **Delhi NCR Metro** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.5.1] — 2026-09-01

### Added

- API docs also served from the app's own domain at `/api`, with `/api/playground`, `/api/docs` and `/api/redoc` alongside the site.

### Fixed

- Release workflow now uses Node 24 so `eas-cli` installs correctly. The v1.5.0 tag failed on Node 20 with `engine node >=22 required`.
- Browser navigations to `/api/...` returned the web app instead of the API. The static-asset SPA fallback answers `Sec-Fetch-Mode: navigate` requests before the Worker runs, so the proxied paths now set `run_worker_first`.
- A base URL ending in `/api` no longer builds `/api/api/v1/...`; `normalizeApiBaseUrl` now strips `/api` as well as `/api/vX`.

## [1.5.0] — 2026-09-01

### Added

- **Web target.** The Expo app now builds for the browser and is live at
  [ncr-metro.tashif.codes](https://ncr-metro.tashif.codes), served by a
  Cloudflare Worker (`app/wrangler.jsonc`) that also reverse-proxies
  `/api/*` to the backend so the page talks to a single origin.
- `bun run build:web`, `preview:web`, and `deploy:web` in `app/`.
- **About screen**, reached from an info button on the home masthead: what the
  app reads from each operator, links to the source and API docs, a privacy
  note, and the running app version and API origin.

### Changed

- Renamed `mobile/` to `app/` and updated all path references, workflows, and docs.
- Rebranded docs landing to **Delhi NCR Metro** and refreshed README with a build-on API guide.
- The web build resolves its API base from the page origin when
  `EXPO_PUBLIC_API_BASE_URL` is unset; native still falls back to the deployed
  API.
- Storage repositories persist to `localStorage` on web instead of SQLite, and
  the metro map downloads through the browser instead of the photo library.
  Native behaviour is unchanged.

### Fixed

- Stop the bottom tab labels from being clipped: they no longer shrink below
  their line height when React Navigation's item padding overflows the bar.
- Centre the network switcher in the app bar instead of pinning it to the top
  edge.
- Replace the browser's default focus ring on web with a themed one shown only
  for keyboard focus.

### Documentation

- Unslopped and rewrote `docs/` with sentence case and human voice, removed non-project guides.

## [1.4.1] — 2026-07-29

### Fixed

- Centre stack titles correctly on iOS when the network switcher is shown, without clipping or overflowing the switcher.
- Allow long header titles to shrink slightly before ellipsising when space is tight.
- Tighten compact network switcher spacing so the control fits cleanly in the app bar.
- Restore the default home tab (journey planner) instead of opening on the map.

### Changed

- Clarify that the network switcher only appears on operator-scoped screens (alerts and map), not on cross-network journey planning.

## [1.4.0] — 2026-07-28

### Added

- **Noida Metro (NMRC)** as a first-class network: stations, line info, map, and service notices scraped from the public NMRC site.
- **Network switcher** to move between Delhi Metro and Noida Metro, with the choice persisted locally.
- **Cross-network journeys** that stitch DMRC and NMRC at the Sector 52 / Sector 51 footbridge, including a transfer walk leg.
- Per-network **fare breakdown** and a clear **separate tickets** flag when a trip needs two operators.
- Operator marks on station and line UI, plus a refreshed network map asset.
- Save the metro map to the photo library via `expo-media-library`.
- API domain packages for DMRC and NMRC, plus interchange and multi-network planner coverage tests.

### Changed

- Renamed the app shell to **Delhi NCR Metro**.
- Nest DMRC routes and services under operator packages; extend the v2 planner for `network` selection and combined plans.
- Scope station search, popular routes, and query caches by network where appropriate.

### Documentation

- Research notes for the NMRC HTML planner flow.
- Backend guide and READMEs updated for dual-network endpoints and transfer behaviour.

## [1.3.0] — 2026-07-28

### Added

- Journey planning through the **v2 Sarthi-backed planner**, with richer legs (platform, direction, distance, applicable fare).
- Automatic fallback to the legacy DMRC planner when Sarthi is unavailable, kept transparent in the UI.
- Station crosswalk so either upstream’s codes can resolve.
- Flattened API layout (domain routes, services, schemas, shared clients).

### Fixed

- Corporate-page notice slug resolution limited to real DMRC `/pages` (and `link_to_file`) targets so expand only opens genuine detail pages.

### Changed

- Mobile plans call `GET /api/v2/journeys/plan` per strategy instead of the dual v1 complete payload.
- Normalize the API origin so v1 notices/maps and the v2 planner share one base.

## [1.2.1] — 2026-07-26

### Fixed

- Notice slug extraction for nested DMRC corporate URLs.
- Open-on-site fallback when notification detail HTML is unavailable.
- Production API packaging for Vercel (ignore/requirements) so deploys only ship the API.

## [1.2.0] — 2026-07-26

### Added

- Full **network map discovery** from the DMRC frontend JS bundle.
- Expandable **notification detail** with sanitized corporate-page HTML.
- Material 3 **motion tokens**, tab focus animation, and intent-based **haptics**.
- Shared stack headers with slide push transitions.

### Fixed

- Pin Reanimated / Expo packages to SDK 54–compatible ranges.
- Load maps with `expo-image`, clearer errors, and retry.
- Keep Material You dark tonal surfaces; pure black only when AMOLED is on.

### Changed

- Motion and haptic polish across home, search, journey results, and station detail.

## [1.1.1] — 2026-07-25

### Added

- Appearance settings: theme mode, palettes, AMOLED, contrast.
- Card, Reveal, and Material 3 Switch primitives.
- Persistent appearance preferences in SQLite.

### Changed

- Screen and card polish against the appearance design system.

## [1.1.0] — 2026-07-25

### Added

- Editable journey endpoints on results.
- New themed app icon.
- Design tokens (fills, contrast, shape) and shared Touchable / StationListSkeleton primitives.

### Changed

- Shared components and tabs restyled with the design system.

## [1.0.1] — 2026-04-16

### Fixed

- Patch release for early production install and backend connectivity issues.

## [1.0.0] — 2026-04-16

### Added

- Initial public release: journey planner, station search, line status, network map, and service alerts for Delhi Metro.

[Unreleased]: https://github.com/tashifkhan/delhi-metro/compare/v1.5.1...HEAD
[1.5.1]: https://github.com/tashifkhan/delhi-metro/compare/v1.5.0...v1.5.1
[1.5.0]: https://github.com/tashifkhan/delhi-metro/compare/v1.4.1...v1.5.0
[1.4.1]: https://github.com/tashifkhan/delhi-metro/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/tashifkhan/delhi-metro/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/tashifkhan/delhi-metro/compare/v1.2.1...v1.3.0
[1.2.1]: https://github.com/tashifkhan/delhi-metro/compare/v1.2.0...v1.2.1
[1.2.0]: https://github.com/tashifkhan/delhi-metro/compare/v1.1.1...v1.2.0
[1.1.1]: https://github.com/tashifkhan/delhi-metro/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/tashifkhan/delhi-metro/compare/v1.0.1...v1.1.0
[1.0.1]: https://github.com/tashifkhan/delhi-metro/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/tashifkhan/delhi-metro/releases/tag/v1.0.0

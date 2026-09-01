# Delhi NCR Metro

Delhi runs on its metro. If you live here you know the feel. A last-minute change at Rajiv Chowk, two different operators who do not share tickets, and three apps that each tell you something slightly different. I kept running into the same friction, so I started wrapping the upstream services into something I could actually build on. This repo is that work.

It is a monorepo for the whole NCR network, Delhi Metro and Noida Metro together:

- `api/`: FastAPI backend that normalizes DMRC APIs and the NMRC public pages into one contract
- `app/`: Expo app with a Delhi and Noida switch that sticks, running on iOS, Android, and the web at [ncr-metro.tashif.codes](https://ncr-metro.tashif.codes)
- `docs/`: the research and guides I wish I had at the start, flows, station crosswalks, and API details

## Repository layout

- `api/`
  - Typed backend with schemas, DMRC clients, and an NMRC HTML scraper
  - `/api/v1` wraps the legacy DMRC website API, one endpoint per upstream resource
  - `/api/v2` plans journeys through the Delhi Metro Sarthi API and falls back to the `/api/v1` planner when Sarthi trips
- `app/`
  - Cross-platform app for journey planning, station search, line browsing, maps, and alerts
  - Also builds the website, served by a Cloudflare Worker that reverse-proxies `/api/*` to the backend so the browser only ever talks to one origin
- `docs/`
  - API and app deep dives, DMRC flow notes, Sarthi research, and release docs

## Quick start

### 1) Run the API

```bash
cd api
uv sync
uv run uvicorn main:app --reload
```

API docs will be available at:

- `http://127.0.0.1:8000/` for the docs landing
- `http://127.0.0.1:8000/playground` for the live playground
- `http://127.0.0.1:8000/docs` for Swagger UI

### 2) Run the app

```bash
cd app
bun install
bun run start   # iOS / Android
bun run web     # browser
```

Set app env in `app/.env`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

### 3) Ship the website

```bash
cd app
bun run deploy:web
```

That exports the web build and deploys the Worker to `ncr-metro.tashif.codes`.

## Build your own thing on the API

The app is just one client. The API underneath is built to be used directly, and I tried to keep the contract boring so you do not have to guess.

It is JSON, REST, no auth. Same schemas for Delhi and Noida, so switching `dmrc` to `nmrc` does not mean learning a second response shape. Errors come back in one predictable shape too, whether you sent a bad station code or an upstream timed out.

- live docs and playground when you run locally at `http://127.0.0.1:8000/` and `http://127.0.0.1:8000/playground`
- production at `https://dmrc-rest-api.vercel.app/` and `https://dmrc-rest-api.vercel.app/playground`, Swagger at `/docs`, OpenAPI JSON at `/openapi.json`
- deep dive at `docs/api-backend-guide.md`, and the raw upstream notes at `docs/dmrc-api-flow.md` and `docs/dmrc-sarthi-api-research.md`

Quick try, no setup:

```bash
# list Delhi Metro lines
curl https://dmrc-rest-api.vercel.app/api/v1/dmrc/lines | jq

# plan a journey on the unified planner, works with either operator's codes
curl "https://dmrc-rest-api.vercel.app/api/v2/journeys/plan?from_station_code=AIIMS&to_station_code=ASDM&strategy=least-distance" | jq
```

The contract is small on purpose.

- `GET /api/v1/dmrc/*` and `GET /api/v1/nmrc/*` mirror the operators one for one, validated with Pydantic so drift surfaces fast.
- `GET /api/v2/journeys/plan` is the nicer planner. Sarthi answers first, DMRC is the fallback, and cross network trips from Delhi to Aqua are stitched at the Sector 52 to 51 walk with `source: "combined"` and fares split in `fare.breakdown` because the tickets are separate.
- bad requests give you `400` or `404` with `upstream_status_code: null`, upstream failures give you `502` with the upstream status kept for debugging. That is the whole error story.

If you are building a bot, a widget, or a different frontend, start from the playground. Set your stations once and hit Run on any endpoint, or copy the curl. The schemas are in `api/schemas/` if you want types.

## Documentation

- API backend guide: `docs/api-backend-guide.md`
- Expo app guide: `docs/expo-app-guide.md`
- DMRC API flow notes: `docs/dmrc-api-flow.md`
- Delhi Metro Sarthi route and API research: `docs/dmrc-sarthi-api-research.md`
- Legacy and Sarthi station ID crosswalk: `docs/station-identifiers.md`
- NMRC HTML research: `docs/nmrc-html-research.md`
- API package README: `api/README.md`
- App package README: `app/README.md`

## Features

This started as a journey planner and grew into a full NCR companion. I built it for the daily commute first, then made the API usable for anything else you want to build.

### For riders

- **Plan trips that actually make sense.** Least distance and minimum interchange, side by side. You see time, fare, the full station list, line changes, and where to get off. Cross from Delhi to Aqua and it stitches at Sector 52 to 51 with a walk leg, split fares in `fare.breakdown`, and `separate_tickets: true` because the operators do not share tickets.
- **Fares and timings that match the day.** Weekday vs weekend, first and last train per strategy, and distance. The v2 planner tells you `applicable` fare for the date you pass in.
- **Find any station fast.** Typeahead search with debounced queries, empty states that explain, and a detail screen with gates, lifts, platforms, facilities, parking, and nearby places. If you know the code from either operator it just works.
- **Browse the network.** Lines with ordered stations, interchange badges, and a terminal to terminal view that reads like a timeline.
- **A map you can actually use.** High resolution network map with pinch, pan, and double tap, plus save to Photos or Gallery when a PDF exists. The backend finds the map by scanning the frontend bundle, so hashed filenames do not break it. If a family has no PDF upstream the API says so instead of failing.
- **Stay on the right network.** Delhi and Noida feel like one app. A switch sticks, caches stay separate per network, and popular routes are kept offline so a repeat trip is one tap even when the network flickers.

### Product capabilities

- **Two operators, one contract.** `GET /api/v1/dmrc/*` and `GET /api/v1/nmrc/*` share the same schemas. NMRC is scraped from public HTML and normalized to that contract, with checked in tables as fallback when a page is unreadable.
- **A planner you can trust to fall back.** `GET /api/v2/journeys/plan` tries Sarthi first for richer legs like platform, direction, and distance, and falls back to the legacy DMRC planner on timeout or 500. You get `source` and `fallback_reason` so you know who answered.
- **Station codes that translate.** Legacy `JRMR` and Sarthi `JRMJ` resolve to the same slug via `api/data/stations.normalized.json` and `core/catalog.py`. Soorghat `SOOG` is legacy only and skips Sarthi cleanly.
- **Built for building.** JSON, REST, no auth. Swagger at `/docs`, OpenAPI at `/openapi.json`, a live playground at `/playground`, and typed schemas in `api/schemas/` if you want to generate clients. Errors are one shape: `400`/`404` for you, `502` for upstream with `upstream_status_code` kept for debugging.

### App polish

- **Fast where it counts.** React Query for caching and retries, SQLite for popular routes, separate offline caches per network.
- **Feels native.** Material 3 with wallpaper colors on Android 12+, a deep black dark mode that lifts with blue, haptics and motion that do not get in the way.
- **Everywhere you need it.** iOS and Android via Expo, web at `ncr-metro.tashif.codes` through a Cloudflare Worker that proxies `/api/*` so the browser stays same origin, and an APK on GitHub Releases plus `https://tashif.codes/fdroid/repo` for F-Droid.

## Notes

The backend depends on upstream DMRC services and NMRC's public passenger pages. That has tradeoffs.

NMRC does not publish an API. The planner is server-rendered HTML, so the backend parses it into the same journey model the Delhi planner uses, with checked-in tables as fallback when a page is unreadable.

Map PDFs are not always published for every family. If a family has no PDF upstream, the API tells you cleanly instead of failing.

For deployment, use environment variables. Do not hardcode hosts or keys.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

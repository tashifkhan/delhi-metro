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
- Mobile package README: `app/README.md`

## What it can do

- List lines and discover stations
- Search stations and show station detail, gates, lifts, platforms, and facilities
- Plan routes with fare and timing across two strategies, least distance and minimum interchange
- Look up first and last train times
- Find and serve DMRC map assets, including the tricky hashed network map
- Cover the NMRC Aqua Line too, stations, fare, time, distance, map, and press releases, from one shared schema
- Remember your network choice and keep separate caches per network so switching feels instant
- Cache popular routes locally and fall back offline when the network drops

## Notes

The backend depends on upstream DMRC services and NMRC's public passenger pages. That has tradeoffs.

NMRC does not publish an API. The planner is server-rendered HTML, so the backend parses it into the same journey model the Delhi planner uses, with checked-in tables as fallback when a page is unreadable.

Map PDFs are not always published for every family. If a family has no PDF upstream, the API tells you cleanly instead of failing.

For deployment, use environment variables. Do not hardcode hosts or keys.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

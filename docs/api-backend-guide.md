# API backend guide

I wrote this API because the upstream metro services are scattered and sometimes flaky, and I wanted one place that normalizes them. This doc covers how the FastAPI backend in `api/` is put together, how to run it locally, and how to call it without guessing.

The code lives in `api/`. The rest of this doc points into it.

## Overview

At its core this is a typed wrapper around DMRC's passenger API and NMRC's public pages. It gives you:

- stable REST routes under `/api/v1`
- validation through Pydantic models so drift shows up early
- one error shape whether you sent a bad code or an upstream timed out
- journey planning, fare, route, first and last train
- map asset discovery plus proxy and redirect endpoints for the actual files

No auth. JSON everywhere. Same schemas for Delhi and Noida so the mobile app does not branch.

## Tech stack

- FastAPI
- Pydantic v2 and pydantic-settings
- httpx for async clients
- uv for deps and running
- Python 3.12 or newer

Nothing exotic. I kept the stack boring so it stays easy to run.

## Project structure

Key folders in `api/`:

- `main.py` creates the FastAPI app, wires routers, sets the lifespan, and maps errors to HTTP responses
- `routes/` holds HTTP route definitions, split by network then by domain
  - `routes/dmrc/` has `lines`, `stations`, `journeys`, `notifications`, `maps`
  - `routes/nmrc/` has `lines`, `stations`, `notifications`, `maps`
  - top level has `health` and `planner` for v2, which touches both networks
- `services/` holds domain logic, split the same way
  - `services/dmrc/` has `line`, `station`, `journey`, `notification`, `map_asset`, and `sarthi`, the preferred DMRC planner
  - `services/nmrc/` has `catalog`, `station`, `journey`, `notification`, `map_asset`, plus `parsing` which is pure HTML parsers and `data` which is checked in reference tables
  - top level has `planner`, which picks a source across networks
- `clients/` holds upstream HTTP clients, each as a shared instance
  - `dmrc` for the passenger API, `frontend` for static assets, `sarthi` for the journey API, `nmrc` for the public website
- `schemas/` holds request and response models and shared types
  - `common`, `line`, `station`, `journey`, `notification`, `map_asset`
  - `sarthi` for raw upstream payloads, `planner` for the normalized v2 models
- `core/config.py` holds runtime settings and env handling
- `core/errors.py` separates errors you caused from errors an upstream caused
- `core/validation.py` has helpers that turn schema drift into upstream errors
- `core/catalog.py` is the station crosswalk between the two code vocabularies
- `data/` is the generated station catalog that `core/catalog.py` loads

Each route module owns its own prefix and tag, for example `APIRouter(prefix="/journeys", tags=["journeys"])`. Each network package's `__init__.py` composes those modules into one router that already carries the network prefix `/dmrc` or `/nmrc`, and `main.py` mounts that single router under the version prefix. To add a new domain you create one module and add one `include_router` line. `main.py` does not change.

Schemas and clients stay flat. Schemas are the shared contract that lets a client switch networks without the caller caring, and each client is already a single module.

## API versions

- `/api/v1` wraps the legacy delhimetrorail.com backend, one endpoint per upstream resource. It is literal and direct.
- `/api/v2` is the nicer journey planner. Sarthi answers first and the v1 DMRC planner is the fallback. See [Journey planning (v2)](#journey-planning-v2).

That split is intentional. v1 tells you what the operators publish. v2 tries to give you the best usable journey.

## Request lifecycle

1. The FastAPI route gets the request.
2. The route calls the matching service function, for example `services.journey.fare_with_route`.
3. The service calls an upstream client, `dmrc_client`, `frontend_client`, or `sarthi_client`.
4. The service validates the payload into typed schema models.
5. If the request itself is wrong, the service raises `ApiRequestError`. If the upstream fails, times out, or returns something unexpected, it raises `UpstreamApiError`.
6. Global handlers turn those two error types into the shared JSON envelope.

For `/api/v2` step 2 goes through `services.planner`. That layer tries `services.sarthi` first and if it gets an `UpstreamApiError` it retries the same request against `services.journey` which is DMRC. Only then does the error reach the global handler.

## Local development

From the repo root:

```bash
cd api
uv sync
uv run uvicorn main:app --reload
```

The API will be at `http://127.0.0.1:8000`.

Useful endpoints when it is running:

- landing page with custom HTML docs at `http://127.0.0.1:8000/`
- live playground at `http://127.0.0.1:8000/playground`
- Swagger UI at `http://127.0.0.1:8000/docs`
- ReDoc at `http://127.0.0.1:8000/redoc`
- OpenAPI JSON at `http://127.0.0.1:8000/openapi.json`

## Configuration

All settings use the `DMRC_` prefix. See `api/core/config.py`.

| Variable | Default | Description |
|---|---|---|
| `DMRC_DEBUG` | `false` | Turn on FastAPI debug behavior |
| `DMRC_DMRC_BASE_URL` | `https://backend.delhimetrorail.com/api/v2/en/` | DMRC passenger API base URL |
| `DMRC_DMRC_TIMEOUT_SECONDS` | `20.0` | Timeout for DMRC passenger API requests |
| `DMRC_DMRC_FRONTEND_BASE_URL` | `https://delhimetrorail.com/` | DMRC frontend host for map assets |
| `DMRC_DMRC_FRONTEND_TIMEOUT_SECONDS` | `20.0` | Timeout for frontend static requests |
| `DMRC_SARTHI_BASE_URL` | `https://dmrc.autope.in/metro/v4/` | Sarthi journey API base URL |
| `DMRC_SARTHI_TIMEOUT_SECONDS` | `8.0` | Timeout for Sarthi, kept short so fallback is fast |
| `DMRC_SARTHI_ENABLED` | `true` | When false, `/api/v2` always uses DMRC |
| `DMRC_STATION_CATALOG_PATH` | `api/data/stations.normalized.json` | Generated station crosswalk file |
| `DMRC_MAP_DOWNLOAD_MAX_BYTES` | `26214400` | Max map file size the proxy will accept |

Put these in `api/.env` for local dev. No need to export them manually each time.

## API prefix

All routes live under:

- `/api/v1`

v2 only has the planner under `/api/v2/journeys/plan` at the moment.

## Endpoint reference

### Health

- `GET /api/v1/health`
  - Returns `{"status": "ok"}`. Use it for deploy checks.

### DMRC core data

- `GET /api/v1/dmrc/lines`
  - All metro lines with colors, codes, and terminals.

- `GET /api/v1/dmrc/notifications`
  - Feed of DMRC passenger notifications.
- `GET /api/v1/dmrc/notifications/{page_slug}`
  - Detail for a notification, normalized from either a corporate page or a press release. Includes raw HTML in `content`.

- `GET /api/v1/dmrc/stations/search?query=<text>&filter=all|least-distance|minimum-interchange`
  - Search by keyword. Leave `query` empty and you get the merged all stations list.

- `GET /api/v1/dmrc/lines/{line_code}/stations`
  - Ordered stations for a line, for example `LN3`, `LN10`, `LN11`.

- `GET /api/v1/dmrc/stations/{station_code}`
  - Rich station payload with geo, facilities, gates, lifts, and platforms.

### Journey planning

- `GET /api/v1/dmrc/journeys/fare-route`
  - Query params are `from_station_code`, `to_station_code`, `strategy`, and optional `journey_time`.
  - Returns route segments, total time, and fare.

- `GET /api/v1/dmrc/journeys/first-last-train`
  - Same required params as above plus `strategy`.
  - Returns first and last train timing details for the chosen strategy.

- `GET /api/v1/dmrc/journeys/complete`
  - Params are `from_station_code`, `to_station_code`, and optional `journey_time`.
  - Returns both strategies in one payload, least distance and minimum interchange, each with fare and timings.

Shorthand routes also exist:

- `GET /api/v1/dmrc/journeys/fare-route/least-distance`
- `GET /api/v1/dmrc/journeys/fare-route/minimum-interchange`
- `GET /api/v1/dmrc/journeys/first-last-train/least-distance`
- `GET /api/v1/dmrc/journeys/first-last-train/minimum-interchange`

### Map asset discovery and delivery

- `GET /api/v1/dmrc/maps/assets`
  - Lists assets found via DMRC's `asset-manifest.json` and the media refs inside the current main JavaScript bundle.

- `GET /api/v1/dmrc/maps/{family}`
  - `family` is `network`, `airport-express`, or `rapid-metro`.
  - Returns primary image and PDF candidates for that family.

- `GET /api/v1/dmrc/maps/{family}/assets?format=image|pdf|any`
  - Same family listing filtered by format.

- `GET /api/v1/dmrc/maps/{family}/download?format=image|pdf|any`
  - 307 redirect to the original DMRC static file URL.

- `GET /api/v1/dmrc/maps/{family}/file?format=image|pdf|any`
  - Streams the bytes through this API instead of redirecting.

- `GET /api/v1/dmrc/maps/assets/{asset_id}`
  - Metadata for a single discovered asset id.

### NMRC (Noida Metro)

Every DMRC resource has an NMRC counterpart at the same path shape and with the same response schema, so you can switch networks without a second contract:

- `GET /api/v1/nmrc/lines`
- `GET /api/v1/nmrc/lines/{line_code}/stations`
- `GET /api/v1/nmrc/stations/search`
- `GET /api/v1/nmrc/stations/{station_code}`
- `GET /api/v1/nmrc/notifications`
- `GET /api/v1/nmrc/maps/assets`
- `GET /api/v1/nmrc/maps/assets/{asset_id}`
- `GET /api/v1/nmrc/maps/{family}`
- `GET /api/v1/nmrc/maps/{family}/assets?format=image|pdf|any`
- `GET /api/v1/nmrc/maps/{family}/download?format=image|pdf|any`
- `GET /api/v1/nmrc/maps/{family}/file?format=image|pdf|any`

NMRC does not publish an API, so `services/nmrc/` reads the operator's public HTML:

| Data | Where it comes from |
|---|---|
| Station catalog | The journey planner's `sourceStation` select options |
| Journeys | The planner form that encrypts the pair and renders the result, hit via `/Captcha/EncryptString` then the planner page |
| Notifications | The press release and archive pages |
| Network map | A static route map image |

Parsing lives in `services/nmrc/parsing.py` as pure functions over HTML, so fixtures can be tested without hitting the network. That is covered in `tests/`. When a page cannot be fetched, the service falls back to checked in tables in `services/nmrc/data.py` with station names, timings, adjacent distances, and published fare slabs. A journey that used that fallback says so in `fallback_reason`.

NMRC runs one line, so `line_code` is always `AQUA`, there are no interchanges, and `format=pdf` returns an empty list because no PDF map is currently published.

## Journey planning (v2)

`GET /api/v2/journeys/plan`

| Query param | Default | Notes |
|---|---|---|
| `from_station_code` | required | Code in either upstream vocabulary |
| `to_station_code` | required | Code in either upstream vocabulary |
| `strategy` | `least-distance` | Or `minimum-interchange` |
| `journey_time` | now | ISO-8601, treated as Delhi local time, affects which fare is applicable |
| `exclude_airport_line` | `false` | Only Sarthi respects this |
| `source` | unset | Pin to `sarthi` or `dmrc` instead of using the fallback chain |
| `network` | `dmrc` | `nmrc` plans on the Aqua Line instead |

The network comes from the station codes themselves. `network` is only a hint for codes that are not in either catalog. If you pin `source` to an upstream that cannot serve the resolved network, the API returns 400.

### Journeys that cross networks

Delhi Metro and Noida Metro are separate systems that touch at one spot. DMRC's Noida Sector 52 `SFTN` on the Blue Line and NMRC's Noida Sector 51 `NM01` at the Aqua Line terminus sit across a foot overbridge. That link is defined once in `services/interchange.py`.

When the two endpoints are on different networks, the planner plans each half against the interchange at the same time and joins them with a walking leg:

```
GET /api/v2/journeys/plan?from_station_code=NSET&to_station_code=NM17

source: "combined", networks: ["dmrc", "nmrc"], separate_tickets: true
  [metro   |dmrc] Blue Line   NOIDA SECTOR-18   to SECTOR - 52 NOIDA   00:10:44
  [transfer|    ] Walk        SECTOR - 52 NOIDA to Noida Sector 51     6 min, 300 m
  [metro   |nmrc] Aqua Line   Noida Sector 51   to Pari Chowk          32 min
total_time: "49 min"   fare: 72 rupees = 32 (dmrc) + 40 (nmrc)
```

- `source` becomes `combined`, and each leg carries its own `source` and `network`.
- A `transfer` leg has `kind: "transfer"`, no line color or platform, and includes `walk_metres` plus a note about the change.
- Fares are summed and also split in `fare.breakdown` because the two networks ticket separately. `separate_tickets` is true only when you actually ride both.
- Durations are summed across the upstream formats `0:38:26`, `31 mins`, `6 min` plus the walk.
- If you start or end at the interchange itself, the planner skips that half. Sector 52 to Sector 51 is just the walk.

### Source selection

1. If `source=dmrc`, or `DMRC_SARTHI_ENABLED=false`, the DMRC planner answers directly.
2. Otherwise Sarthi is tried first.
3. Any `UpstreamApiError` from Sarthi, timeout, transport error, HTTP 500, schema drift, or a station missing from its catalog, falls back to DMRC. The API logs it at warning level and sets `fallback_reason` so you can see why.
4. With `source=sarthi`, failures are returned, not retried as DMRC.

Sarthi is never retried on its own. It reports bad station codes, bad strategies, and same origin and destination all as a generic HTTP 500, so a retry would not help.

### Response

`PlannedJourney` has the same shape from both sources. `source` tells you who answered, and these fields come from Sarthi only:

- per journey are `total_distance_km`, `ticket_available`, `fare.applicable`
- per leg are `line_color`, `direction`, `platform_name`, `towards_station`, `distance_km`, `start_time`, `end_time`
- per station is `status`

Per leg `start_time` and `end_time` follow the upstream server clock, not your requested future `journey_time`. Treat them as indicative.

`exclude_airport_line` in the response tells you whether exclusion was actually applied, not what you asked for. A DMRC fallback plan always reports `false`.

The two planners can disagree and that is normal. For AIIMS to Akshardham on `least-distance`, Sarthi gave Yellow to Blue with 14 stations in 31 mins while DMRC gave Yellow to Pink to Blue with 9 stations in 38:26. Same inputs, different graphs.

## Station identifier crosswalk

The two upstreams disagree on three station codes, `JRMR` versus `JRMJ`, `KPEN` versus `KPE`, and Sikanderpur where legacy `SKRP` maps to both Sarthi `SKRP` and `SKY`. `core/catalog.py` loads the generated catalog once and resolves a code from either vocabulary to the canonical station, then to the code the target upstream expects.

For Sikanderpur it prefers the Sarthi record whose name matches the canonical name, which is the main Yellow Line station rather than the Rapid Metro one.

Soorghat `SOOG` exists only in the legacy catalog, so any journey that touches it skips Sarthi entirely and is served by DMRC.

Regenerate the catalog with `uv run python scripts/normalize_station_catalogs.py` and see `docs/station-identifiers.md` for details.

## Error handling

Failures are normalized into one JSON shape. Example:

```json
{
  "detail": "DMRC upstream returned error for path '... '",
  "upstream_status_code": 404
}
```

- Bad requests or unknown resources you asked for return 400 or 404 with `upstream_status_code` as null.
- Any upstream HTTP, transport, or schema failure returns 502. The original upstream status is kept in `upstream_status_code` so you can debug.

## Integration notes

- The service normalizes station codes to uppercase for you.
- `journey_time` must be ISO-8601 when you send it.
- DMRC can be picky about browser like headers. The clients already set sensible defaults.
- Map assets are found dynamically by scanning the frontend manifest and the main bundle, so hashed filenames do not go stale. The full network map is ranked above DMRC's small `mapimg` preview. Manifest paths are limited to the configured frontend origin, and proxied files are size and content type limited and cached.

## Related docs

- API reverse engineering and DMRC flow notes at `docs/dmrc-api-flow.md`
- Mobile app integration details at `docs/expo-app-guide.md`

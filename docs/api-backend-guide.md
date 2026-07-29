# API Backend Guide

This document explains the Delhi Metro FastAPI backend in this repository: how it is structured, how to run it, and how to consume its endpoints.

## Overview

The API is a typed wrapper over DMRC upstream services. It provides:

- Stable REST endpoints under `/api/v1`
- Typed validation using Pydantic models
- Unified error handling for upstream failures
- Journey planning endpoints (fare, route, first/last train)
- Map asset discovery and map file proxy/redirect endpoints

The backend source lives in `api/`.

## Tech Stack

- FastAPI
- Pydantic v2 + pydantic-settings
- httpx (async clients)
- uv (dependency and runtime tooling)
- Python 3.12+

## Project Structure

Key directories in `api/`:

- `main.py`: FastAPI app creation, router registration, lifespan, exception mapping
- `routes/`: HTTP route definitions, split by network then by domain
  - `routes/dmrc/`: `lines`, `stations`, `journeys`, `notifications`, `maps`
  - `routes/nmrc/`: `lines`, `stations`, `notifications`, `maps`
  - top level: `health`, and `planner` for v2, which spans both networks
- `services/`: domain logic, split the same way
  - `services/dmrc/`: `line`, `station`, `journey`, `notification`,
    `map_asset`, and `sarthi` (the preferred DMRC planner)
  - `services/nmrc/`: `catalog`, `station`, `journey`, `notification`,
    `map_asset`, plus `parsing` (pure HTML parsers) and `data` (checked-in
    reference tables)
  - top level: `planner`, which selects a source across networks
- `clients/`: upstream HTTP clients, each exposing a shared instance
  - `dmrc` (passenger API), `frontend` (static assets), `sarthi` (journey API),
    `nmrc` (public website)
- `schemas/`: request/response typing and data models
  - `common`, `line`, `station`, `journey`, `notification`, `map_asset`
  - `sarthi` (raw upstream payloads), `planner` (normalized v2 models)
- `core/config.py`: runtime settings and environment configuration
- `core/errors.py`: separate caller-visible and upstream error types
- `core/validation.py`: payload validation helpers that map schema drift to upstream errors
- `core/catalog.py`: station crosswalk between the two upstreams' code vocabularies
- `data/`: generated station catalog consumed by `core/catalog.py`

Each route module owns its domain prefix and tag (for example
`APIRouter(prefix="/journeys", tags=["journeys"])`). Each network package's
`__init__.py` composes those modules into one router carrying the network
prefix (`/dmrc`, `/nmrc`), and `main.py` mounts that single router under its
version prefix. Adding a domain to a network is therefore a new module plus one
`include_router` line, and `main.py` never changes.

Schemas and clients stay flat: the schemas are the shared contract that lets a
client switch networks, and each client is one module already.

## API Versions

- `/api/v1` wraps the legacy delhimetrorail.com backend, one endpoint per
  upstream resource.
- `/api/v2` is journey planning served by the Delhi Metro Sarthi API, with the
  v1 DMRC planner as its fallback. See
  [Journey Planning (v2)](#journey-planning-v2).

## Request Lifecycle

1. FastAPI route receives request.
2. Route calls the matching service function (for example `services.journey.fare_with_route`).
3. Service calls an upstream client (`dmrc_client`, `frontend_client`, or `sarthi_client`).
4. Response payload is validated into typed schema models.
5. Local request/resource failures raise `ApiRequestError`; upstream transport,
   HTTP, and schema failures raise `UpstreamApiError`.
6. Global handlers map those errors to the shared API JSON envelope.

For `/api/v2`, step 2 goes through `services.planner`, which tries
`services.sarthi` first and catches `UpstreamApiError` to retry the request
against `services.journey` (DMRC) before any error reaches step 6.

## Local Development

From the repository root:

```bash
cd api
uv sync
uv run uvicorn main:app --reload
```

API will be available at `http://127.0.0.1:8000`.

Documentation endpoints:

- Landing page (custom HTML docs): `http://127.0.0.1:8000/`
- Live playground: `http://127.0.0.1:8000/playground`
- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Configuration

All settings use the `DMRC_` environment prefix (see `api/core/config.py`).

| Variable | Default | Description |
|---|---|---|
| `DMRC_DEBUG` | `false` | Enables FastAPI debug behavior |
| `DMRC_DMRC_BASE_URL` | `https://backend.delhimetrorail.com/api/v2/en/` | DMRC passenger API base URL |
| `DMRC_DMRC_TIMEOUT_SECONDS` | `20.0` | Timeout for DMRC passenger API requests |
| `DMRC_DMRC_FRONTEND_BASE_URL` | `https://delhimetrorail.com/` | DMRC frontend host for map assets |
| `DMRC_DMRC_FRONTEND_TIMEOUT_SECONDS` | `20.0` | Timeout for frontend static requests |
| `DMRC_SARTHI_BASE_URL` | `https://dmrc.autope.in/metro/v4/` | Sarthi journey API base URL |
| `DMRC_SARTHI_TIMEOUT_SECONDS` | `8.0` | Timeout for Sarthi requests, kept short so fallback is fast |
| `DMRC_SARTHI_ENABLED` | `true` | When false, `/api/v2` is served from DMRC only |
| `DMRC_STATION_CATALOG_PATH` | `api/data/stations.normalized.json` | Generated station crosswalk |
| `DMRC_MAP_DOWNLOAD_MAX_BYTES` | `26214400` | Maximum map file size accepted by the proxy |

You can place these in `api/.env` for local development.

## API Prefix

All routes are under:

- `/api/v1`

## Endpoint Reference

### Health

- `GET /api/v1/health`
  - Returns `{"status": "ok"}`

### DMRC Core Data

- `GET /api/v1/dmrc/lines`
  - Returns all metro lines

- `GET /api/v1/dmrc/notifications`
  - Returns DMRC passenger notifications feed
- `GET /api/v1/dmrc/notifications/{page_slug}`
  - Returns normalized corporate-page or press-release detail, including raw HTML content

- `GET /api/v1/dmrc/stations/search?query=<text>&filter=all|least-distance|minimum-interchange`
  - Search stations by keyword
  - Empty `query` returns a merged all-stations list

- `GET /api/v1/dmrc/lines/{line_code}/stations`
  - Returns ordered stations for a line (for example `LN3`, `LN10`, `LN11`)

- `GET /api/v1/dmrc/stations/{station_code}`
  - Returns detailed station payload (geo, facilities, gates, lifts, platforms)

### Journey Planning

- `GET /api/v1/dmrc/journeys/fare-route`
  - Query params: `from_station_code`, `to_station_code`, `strategy`, optional `journey_time`
  - Returns route segments, total time, and fare

- `GET /api/v1/dmrc/journeys/first-last-train`
  - Query params: `from_station_code`, `to_station_code`, `strategy`
  - Returns first/last train route timing details

- `GET /api/v1/dmrc/journeys/complete`
  - Query params: `from_station_code`, `to_station_code`, optional `journey_time`
  - Returns both strategies in one payload:
    - least-distance fare + first/last train
    - minimum-interchange fare + first/last train

Convenience strategy-specific endpoints are also available:

- `GET /api/v1/dmrc/journeys/fare-route/least-distance`
- `GET /api/v1/dmrc/journeys/fare-route/minimum-interchange`
- `GET /api/v1/dmrc/journeys/first-last-train/least-distance`
- `GET /api/v1/dmrc/journeys/first-last-train/minimum-interchange`

### Map Asset Discovery and Delivery

- `GET /api/v1/dmrc/maps/assets`
  - Lists assets discovered from DMRC's `asset-manifest.json` and the media
    references embedded in its current main JavaScript bundle

- `GET /api/v1/dmrc/maps/{family}`
  - `family`: `network`, `airport-express`, `rapid-metro`
  - Returns primary image and PDF candidates for a family

- `GET /api/v1/dmrc/maps/{family}/assets?format=image|pdf|any`
  - Lists family assets filtered by format

- `GET /api/v1/dmrc/maps/{family}/download?format=image|pdf|any`
  - 307 redirect to original DMRC static file URL

- `GET /api/v1/dmrc/maps/{family}/file?format=image|pdf|any`
  - Proxies file bytes through this API

- `GET /api/v1/dmrc/maps/assets/{asset_id}`
  - Returns metadata for a discovered asset ID

### NMRC (Noida Metro)

Every DMRC resource endpoint has an NMRC counterpart at the same path shape and
with the same response schema, so a client can switch networks without a second
contract:

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

NMRC publishes no API, so `services/nmrc/` reads the operator's public HTML:

| Data | Source |
|---|---|
| Station catalog | The journey planner's `sourceStation` select |
| Journeys | The planner's encrypt-then-render form (`/Captcha/EncryptString`, then the planner page) |
| Notifications | The press-release and archive pages |
| Network map | A static route-map image |

Parsing is isolated in `services/nmrc/parsing.py` as pure functions over HTML,
so page fixtures can be tested without network access (`tests/`). When a page
cannot be read, the service falls back to the checked-in tables in
`services/nmrc/data.py` — station names, timings, adjacent distances, and the
published fare slabs — and a journey planned that way reports it in
`fallback_reason`.

NMRC operates one line, so `line_code` is `AQUA`, there are no interchanges,
and `format=pdf` returns an empty list because no PDF map is published.

## Journey Planning (v2)

`GET /api/v2/journeys/plan`

| Query param | Default | Notes |
|---|---|---|
| `from_station_code` | required | Either upstream's vocabulary |
| `to_station_code` | required | Either upstream's vocabulary |
| `strategy` | `least-distance` | Or `minimum-interchange` |
| `journey_time` | now | ISO-8601, read as Delhi local time; affects applicable fare |
| `exclude_airport_line` | `false` | Honoured by Sarthi only |
| `source` | unset | Pin to `sarthi` or `dmrc` instead of using the fallback chain |
| `network` | `dmrc` | `nmrc` plans on the Noida Metro Aqua Line instead |

The network is resolved from the station codes themselves; `network` is only a
hint for a code that resolves in neither catalog. Pinning `source` to an
upstream that cannot serve the resolved network is rejected with a 400.

### Journeys that cross networks

Delhi Metro and Noida Metro are separate networks joined at one point: DMRC's
Noida Sector 52 (`SFTN`, Blue Line) and NMRC's Noida Sector 51 (`NM01`, the
Aqua Line terminus) are adjacent stations linked by a foot-overbridge. That
link is defined once in `services/interchange.py`.

When the two endpoints resolve to different networks, the planner plans each
half against the interchange station concurrently and joins them with a
walking leg:

```
GET /api/v2/journeys/plan?from_station_code=NSET&to_station_code=NM17

source: "combined", networks: ["dmrc", "nmrc"], separate_tickets: true
  [metro   |dmrc] Blue Line   NOIDA SECTOR-18   → SECTOR - 52 NOIDA   00:10:44
  [transfer|    ] Walk        SECTOR - 52 NOIDA → Noida Sector 51     6 min, 300 m
  [metro   |nmrc] Aqua Line   Noida Sector 51   → Pari Chowk          32 min
total_time: "49 min"   fare: ₹72 = ₹32 (dmrc) + ₹40 (nmrc)
```

- `source` is `combined`, and each leg carries its own `source` and `network`.
- A `transfer` leg has `kind: "transfer"`, no line colour or platform, and
  carries `walk_metres` plus a `note` explaining the change.
- Fares are summed and split in `fare.breakdown`, because the two networks
  ticket separately. `separate_tickets` is true only when both halves are
  actually ridden.
- Durations are summed across upstream formats (`0:38:26`, `31 mins`, `6 min`)
  plus the walk.
- Starting or ending at the interchange itself skips that half; Sector 52 to
  Sector 51 is just the walk.

### Source selection

1. If `source=dmrc`, or `DMRC_SARTHI_ENABLED=false`, the DMRC planner answers.
2. Otherwise Sarthi is tried first.
3. Any `UpstreamApiError` from Sarthi — timeout, transport error, HTTP 500,
   schema drift, or a station absent from its catalog — falls back to DMRC and
   is logged at warning level and reported in `fallback_reason`.
4. With `source=sarthi`, failures are returned rather than falling back.

Sarthi is never retried: it reports invalid station codes, invalid strategies,
and same-origin journeys as a generic HTTP 500, so a retry cannot succeed.

### Response

`PlannedJourney` is the same shape from both sources. `source` names the
upstream that answered, and these fields are populated by Sarthi only:

- per journey: `total_distance_km`, `ticket_available`, `fare.applicable`
- per leg: `line_color`, `direction`, `platform_name`, `towards_station`,
  `distance_km`, `start_time`, `end_time`
- per station: `status`

Per-leg `start_time`/`end_time` follow the upstream's current server time
rather than a requested future `journey_time`; treat them as indicative.

`exclude_airport_line` in the response reports whether exclusion was actually
applied, not what was requested — a DMRC fallback plan always reports `false`.

The two planners can legitimately disagree. For AIIMS to Akshardham on
`least-distance`, Sarthi returns Yellow → Blue (14 stations, 31 mins) while
DMRC returns Yellow → Pink → Blue (9 stations, 38:26).

## Station Identifier Crosswalk

The two upstreams disagree on three station codes (`JRMR`/`JRMJ`,
`KPEN`/`KPE`, and Sikanderpur, where legacy `SKRP` maps to both Sarthi `SKRP`
and `SKY`). `core/catalog.py` loads the generated catalog once and resolves a
code from either vocabulary to the canonical station, then to the code the
target upstream expects.

For Sikanderpur it prefers the Sarthi record whose name matches the canonical
name, which is the main-network (Yellow Line) station rather than the Rapid
Metro one.

Soorghat (`SOOG`) exists only in the legacy catalog, so a journey touching it
short-circuits before the Sarthi request and is served by DMRC.

Regenerate the catalog with
`uv run python scripts/normalize_station_catalogs.py`; see
`docs/station-identifiers.md`.

## Error Handling

Caller validation and upstream failures are normalized into one JSON envelope.

Typical shape:

```json
{
  "detail": "DMRC upstream returned error for path '... '",
  "upstream_status_code": 404
}
```

Behavior:

- Locally validated bad requests and missing wrapper resources return 400/404.
- Every upstream HTTP/transport/schema failure returns 502, while preserving
  the upstream status in `upstream_status_code` for diagnostics.

## Integration Notes

- Station codes are normalized to uppercase by service logic.
- `journey_time` must be ISO-8601 datetime when provided.
- DMRC upstream can be sensitive to non-browser headers; client defaults are preconfigured.
- Map assets are discovered dynamically from the frontend manifest and main
  bundle to avoid stale hashed filenames. The full network map is ranked above
  DMRC's small `mapimg` preview. Manifest paths are restricted to the configured
  frontend origin, while proxied files are size- and content-type-limited and
  cached.

## Related Docs

- API reverse-engineering and DMRC flow notes: `docs/DMRC_API_FLOW.md`
- Mobile app integration details: `docs/expo-app-guide.md`

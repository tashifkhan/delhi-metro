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
- `routes/`: HTTP route definitions, one module per domain
  - v1: `health`, `lines`, `stations`, `journeys`, `notifications`, `maps`
  - v2: `planner`
- `services/`: domain logic, one module per domain
  - `line`, `station`, `journey`, `notification`, `map_asset`
  - `sarthi` (Sarthi planner) and `planner` (source selection with fallback)
- `clients/`: upstream HTTP clients, each exposing a shared instance
  - `dmrc` (passenger API), `frontend` (static assets), `sarthi` (journey API)
- `schemas/`: request/response typing and data models
  - `common`, `line`, `station`, `journey`, `notification`, `map_asset`
  - `sarthi` (raw upstream payloads), `planner` (normalized v2 models)
- `core/config.py`: runtime settings and environment configuration
- `core/errors.py`: shared upstream error type
- `core/validation.py`: payload validation helpers that map schema drift to upstream errors
- `core/catalog.py`: station crosswalk between the two upstreams' code vocabularies
- `data/`: generated station catalog consumed by `core/catalog.py`

Each route module owns its own URL prefix and tag (for example
`APIRouter(prefix="/dmrc/journeys", tags=["journeys"])`), and `main.py` mounts
each router under its version prefix.

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
5. If upstream or validation fails, `UpstreamApiError` is raised.
6. Global exception handler maps that error to API JSON responses.

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

OpenAPI endpoints:

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

Upstream and validation failures are normalized into JSON error responses.

Typical shape:

```json
{
  "detail": "DMRC upstream returned error for path '... '",
  "upstream_status_code": 404
}
```

Behavior:

- Upstream 4xx is forwarded as 4xx.
- Other upstream/service failures are returned as 502.

## Integration Notes

- Station codes are normalized to uppercase by service logic.
- `journey_time` must be ISO-8601 datetime when provided.
- DMRC upstream can be sensitive to non-browser headers; client defaults are preconfigured.
- Map assets are discovered dynamically from the frontend manifest and main
  bundle to avoid stale hashed filenames. The full network map is ranked above
  DMRC's small `mapimg` preview.

## Related Docs

- API reverse-engineering and DMRC flow notes: `docs/DMRC_API_FLOW.md`
- Mobile app integration details: `docs/expo-app-guide.md`

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

Key directories in `api/app/`:

- `main.py`: FastAPI app creation, lifespan, exception mapping
- `api/router.py`: root router composition
- `api/dependencies.py`: singleton dependency wiring
- `routers/`: HTTP route definitions (`health`, `dmrc`)
- `services/`: domain logic for DMRC and map flows
- `clients/`: upstream HTTP clients (DMRC API and DMRC frontend)
- `schemas/`: request/response typing and data models
- `core/config.py`: runtime settings and environment configuration
- `core/errors.py`: shared upstream error type

## Request Lifecycle

1. FastAPI route receives request.
2. Route calls service from dependency injection (`DmrcService` or `MapService`).
3. Service calls an upstream client (`DmrcApiClient` or `DmrcFrontendClient`).
4. Response payload is validated into typed schema models.
5. If upstream or validation fails, `UpstreamApiError` is raised.
6. Global exception handler maps that error to API JSON responses.

## Local Development

From the repository root:

```bash
cd api
uv sync
uv run uvicorn app.main:app --reload
```

API will be available at `http://127.0.0.1:8000`.

OpenAPI endpoints:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## Configuration

All settings use the `DMRC_` environment prefix (see `api/app/core/config.py`).

| Variable | Default | Description |
|---|---|---|
| `DMRC_DEBUG` | `false` | Enables FastAPI debug behavior |
| `DMRC_DMRC_BASE_URL` | `https://backend.delhimetrorail.com/api/v2/en/` | DMRC passenger API base URL |
| `DMRC_DMRC_TIMEOUT_SECONDS` | `20.0` | Timeout for DMRC passenger API requests |
| `DMRC_DMRC_FRONTEND_BASE_URL` | `https://delhimetrorail.com/` | DMRC frontend host for map assets |
| `DMRC_DMRC_FRONTEND_TIMEOUT_SECONDS` | `20.0` | Timeout for frontend static requests |

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
  - Returns the detailed corporate page for a notification, including raw HTML content

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

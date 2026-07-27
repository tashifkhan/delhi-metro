# DMRC FastAPI Wrapper

Typed, modular FastAPI wrapper over selected DMRC passenger APIs.

## Stack

- FastAPI
- Pydantic v2
- httpx (async)
- uv (dependency + runtime)

## Structure

```
main.py        FastAPI app, router registration, error mapping
routes/        one module per domain: health, lines, stations, journeys,
               notifications, maps (v1), planner (v2)
services/      one module per domain: line, station, journey, notification,
               map_asset, sarthi, planner
clients/       upstream HTTP clients: dmrc (passenger API), frontend (static
               assets), sarthi (journey API)
schemas/       pydantic models: common, line, station, journey, notification,
               map_asset, sarthi, planner
core/          config, errors, validation helpers, station crosswalk
scripts/       standalone research/probe and catalog-generation scripts
data/          generated legacy/Sarthi station ID and slug crosswalk
```

Routes own their URL prefix and OpenAPI tag; services hold the domain logic as
plain async functions and call the shared client instances.

## Run locally

```bash
uv sync
uv run uvicorn main:app --reload
```

Open docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## API versions

- `/api/v1` — legacy DMRC website API wrapper, one endpoint per upstream resource
- `/api/v2` — journey planning served by Delhi Metro Sarthi, with `/api/v1`'s
  DMRC planner as the fallback

### v2 planner

```
GET /api/v2/journeys/plan
  ?from_station_code=AIIMS
  &to_station_code=ASDM
  &strategy=least-distance|minimum-interchange
  &journey_time=<ISO-8601, optional>
  &exclude_airport_line=false
  &source=sarthi|dmrc            # optional, pins the upstream
```

One normalized `PlannedJourney` is returned regardless of which upstream
answered:

- `source` reports the upstream that served the plan.
- `fallback_reason` is set when Sarthi failed and DMRC served the request.
- Sarthi-only fields (`platform_name`, `direction`, `towards_station`,
  `distance_km`, `line_color`, per-journey `total_distance_km`) are `null` on a
  fallback plan.
- `exclude_airport_line` reports whether exclusion was actually applied; the
  DMRC planner has no such switch, so a fallback plan reports `false`.
- Station codes may be given in either upstream's vocabulary; they are
  translated through the crosswalk in `data/stations.normalized.json`.

Failure behavior: Sarthi reports bad input and internal faults alike as a
generic HTTP 500, so it is never retried. Any Sarthi failure — timeout,
transport error, 500, schema drift, or a station missing from its catalog —
degrades to DMRC. Only a subsequent DMRC failure surfaces as an error.

### v1 endpoints

- `GET /api/v1/health`
- `GET /api/v1/dmrc/lines`
- `GET /api/v1/dmrc/notifications`
- `GET /api/v1/dmrc/notifications/{page_slug}`
- `GET /api/v1/dmrc/stations/search`
- `GET /api/v1/dmrc/lines/{line_code}/stations`
- `GET /api/v1/dmrc/stations/{station_code}`
- `GET /api/v1/dmrc/journeys/fare-route`
- `GET /api/v1/dmrc/journeys/fare-route/least-distance`
- `GET /api/v1/dmrc/journeys/fare-route/minimum-interchange`
- `GET /api/v1/dmrc/journeys/first-last-train`
- `GET /api/v1/dmrc/journeys/first-last-train/least-distance`
- `GET /api/v1/dmrc/journeys/first-last-train/minimum-interchange`
- `GET /api/v1/dmrc/journeys/complete`
- `GET /api/v1/dmrc/maps/assets`
- `GET /api/v1/dmrc/maps/{family}`
- `GET /api/v1/dmrc/maps/{family}/assets?format=image|pdf|any`
- `GET /api/v1/dmrc/maps/{family}/download?format=image|pdf|any`
- `GET /api/v1/dmrc/maps/{family}/file?format=image|pdf|any`
- `GET /api/v1/dmrc/maps/assets/{asset_id}`

## Configuration

Environment variables (optional):

- `DMRC_DEBUG` (default: `false`)
- `DMRC_DMRC_BASE_URL` (default: `https://backend.delhimetrorail.com/api/v2/en/`)
- `DMRC_DMRC_TIMEOUT_SECONDS` (default: `20.0`)
- `DMRC_DMRC_FRONTEND_BASE_URL` (default: `https://delhimetrorail.com/`)
- `DMRC_DMRC_FRONTEND_TIMEOUT_SECONDS` (default: `20.0`)
- `DMRC_SARTHI_BASE_URL` (default: `https://dmrc.autope.in/metro/v4/`)
- `DMRC_SARTHI_TIMEOUT_SECONDS` (default: `8.0`, deliberately short so a slow
  upstream falls back quickly)
- `DMRC_SARTHI_ENABLED` (default: `true`; set `false` to serve `/api/v2` from
  DMRC only)
- `DMRC_STATION_CATALOG_PATH` (default: `data/stations.normalized.json`)

## Station ID crosswalk

The two upstreams use different IDs and occasionally different station codes.
Refresh the checked-in normalized JSON and CSV catalogs with:

```bash
uv run python scripts/normalize_station_catalogs.py \
  --json-output data/stations.normalized.json \
  --csv-output data/stations.normalized.csv
```

See `../docs/station-identifiers.md` for the schema, lookup indexes, matching
rules, and the current unmatched-station report.

## Notes

- `family` values: `network`, `airport-express`, `rapid-metro`.
- If DMRC does not currently publish a PDF for a family (for example, airport-express
  or rapid-metro in the observed build), PDF fields return `null` or file endpoints
  return `404`.

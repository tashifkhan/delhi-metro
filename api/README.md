# Delhi NCR Metro FastAPI Wrapper

Typed, modular FastAPI wrapper over DMRC passenger APIs and NMRC public pages.

## Stack

- FastAPI
- Pydantic v2
- httpx (async)
- uv (dependency + runtime)

## Structure

```
main.py        FastAPI app, router registration, error mapping
routes/
  health.py    liveness probe
  planner.py   v2 journey planner, spans both networks
  dmrc/        lines, stations, journeys, notifications, maps
  nmrc/        lines, stations, notifications, maps
services/
  planner.py   v2 source selection with fallback, spans both networks
  dmrc/        line, station, journey, notification, map_asset, sarthi
  nmrc/        catalog, station, journey, notification, map_asset, plus
               parsing (HTML) and data (checked-in reference tables)
clients/       upstream HTTP clients: dmrc (passenger API), frontend (static
               assets), sarthi (journey API), nmrc (public website)
schemas/       pydantic models shared by both networks: common, line, station,
               journey, notification, map_asset, sarthi, planner
core/          config, errors, validation helpers, station crosswalk
scripts/       standalone research/probe and catalog-generation scripts
data/          generated legacy/Sarthi station ID and slug crosswalk
tests/         unittest suite, runnable with `python -m unittest discover -s tests`
```

`routes/` and `services/` are split by **network** first, then by domain.
`routes/dmrc/__init__.py` and `routes/nmrc/__init__.py` each compose their
domain modules into one router carrying the network prefix, so `main.py`
mounts networks rather than individual domains. Anything spanning both networks
(the v2 planner) stays at the top level, as do `schemas/` and `clients/` —
schemas are the shared contract that makes the two networks interchangeable.

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
NMRC (Noida Metro) mirrors the DMRC paths and schemas one-for-one:

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

`GET /api/v2/journeys/plan` resolves the network from the station codes, so an
Aqua Line journey needs no extra parameter. When the endpoints sit on
different networks the planner stitches both halves together through the
Sector 52/51 foot-overbridge (`services/interchange.py`), returning
`source: "combined"`, a `transfer` leg for the walk, and fares summed with a
per-network `breakdown` since the two operators ticket separately.

NMRC publishes no API, so `services/nmrc/` scrapes the operator's public pages:
station names come from the journey planner's select, journeys from its
encrypt-then-render form, notices from the press-release pages, and the map
from a static image. Parsing lives in `services/nmrc/parsing.py` as pure
functions over HTML; when a page cannot be read, the service falls back to the
checked-in tables in `services/nmrc/data.py` and reports that in the journey's
`fallback_reason`.

## Configuration

Environment variables (optional):

- `DMRC_DEBUG` (default: `false`)
- `DMRC_DMRC_BASE_URL` (default: `https://backend.delhimetrorail.com/api/v2/en/`)
- `DMRC_DMRC_TIMEOUT_SECONDS` (default: `20.0`)
- `DMRC_DMRC_FRONTEND_BASE_URL` (default: `https://delhimetrorail.com/`)
- `DMRC_DMRC_FRONTEND_TIMEOUT_SECONDS` (default: `20.0`)
- `DMRC_MAP_DOWNLOAD_MAX_BYTES` (default: `26214400`, or 25 MiB)
- `DMRC_NMRC_BASE_URL` (default: `https://www.nmrcnoida.com/`)
- `DMRC_NMRC_TIMEOUT_SECONDS` (default: `20.0`)
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
- NMRC currently publishes one Aqua Line network, so its only populated map
  family is `network`.
- NMRC's malformed `Access-Control-Allow-Origin :` response header is rejected
  by strict HTTP parsers. Its client uses a tolerant standard-library transport
  in a worker thread so FastAPI's event loop remains non-blocking.
- If DMRC does not currently publish a PDF for a family (for example, airport-express
  or rapid-metro in the observed build), PDF fields return `null` or file endpoints
  return `404`.

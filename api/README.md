# DMRC FastAPI Wrapper

Typed, modular FastAPI wrapper over selected DMRC passenger APIs.

## Stack

- FastAPI
- Pydantic v2
- httpx (async)
- uv (dependency + runtime)

## Run locally

```bash
uv sync
uv run uvicorn app.main:app --reload
```

Open docs:

- Swagger UI: `http://127.0.0.1:8000/docs`
- ReDoc: `http://127.0.0.1:8000/redoc`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`

## API prefix

- ` /api/v1`

Main endpoints:

- `GET /api/v1/health`
- `GET /api/v1/dmrc/lines`
- `GET /api/v1/dmrc/notifications`
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

## Notes

- `family` values: `network`, `airport-express`, `rapid-metro`.
- If DMRC does not currently publish a PDF for a family (for example, airport-express
  or rapid-metro in the observed build), PDF fields return `null` or file endpoints
  return `404`.

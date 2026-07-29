"""FastAPI application entrypoint.

This module creates the ASGI app, registers routers, and maps service-level
errors to HTTP errors suitable for client integrations.

Run the API using:

    uv run uvicorn main:app --reload
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from clients.dmrc import dmrc_client
from clients.frontend import frontend_client
from clients.nmrc import nmrc_client
from clients.sarthi import sarthi_client
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from routes import dmrc, health, nmrc, planner
from routes.docs import docs_router
from schemas.common import ApiErrorResponse

API_V1_PREFIX = "/api/v1"
API_V2_PREFIX = "/api/v2"


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ensure async HTTP clients are closed on shutdown."""

    yield
    await dmrc_client.close()
    await frontend_client.close()
    await nmrc_client.close()
    await sarthi_client.close()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    debug=settings.debug,
    lifespan=lifespan,
    responses={
        400: {"model": ApiErrorResponse, "description": "Invalid request."},
        404: {"model": ApiErrorResponse, "description": "Resource not found."},
        502: {"model": ApiErrorResponse, "description": "Upstream service failure."},
    },
    openapi_tags=[
        {
            "name": "health",
            "description": "Operational probes for the API process.",
        },
        {
            "name": "lines",
            "description": "Metro line catalog and per-line station sequences.",
        },
        {
            "name": "stations",
            "description": "Station search and station detail lookups.",
        },
        {
            "name": "journeys",
            "description": "Fare, route, and first/last train journey planning.",
        },
        {
            "name": "notifications",
            "description": "DMRC passenger notices and their detail pages.",
        },
        {
            "name": "maps",
            "description": "Network map asset discovery and file delivery.",
        },
        {
            "name": "nmrc",
            "description": (
                "Noida Metro passenger data normalized from public HTML pages "
                "into the same schemas as the DMRC endpoints."
            ),
        },
        {
            "name": "planner",
            "description": (
                "v2 journey planning. DMRC journeys are served by the Delhi "
                "Metro Sarthi API with the legacy DMRC planner as fallback; "
                "`network=nmrc` plans on the Noida Metro Aqua Line."
            ),
        },
    ],
)


@app.exception_handler(UpstreamApiError)
async def handle_upstream_error(
    _: Request,
    exc: UpstreamApiError,
) -> JSONResponse:
    """Translate upstream failures to API-friendly 502 responses."""

    return JSONResponse(
        status_code=502,
        content={
            "detail": exc.message,
            "upstream_status_code": exc.status_code,
        },
    )


@app.exception_handler(ApiRequestError)
async def handle_request_error(
    _: Request,
    exc: ApiRequestError,
) -> JSONResponse:
    """Return locally determined request/resource errors without gateway metadata."""

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.message,
            "upstream_status_code": None,
        },
    )


# Custom docs landing at `/` and playground at `/playground`.
# FastAPI Swagger / ReDoc remain at `/docs` and `/redoc`.
app.include_router(docs_router)

app.include_router(health.router, prefix=API_V1_PREFIX)
app.include_router(dmrc.router, prefix=API_V1_PREFIX)
app.include_router(nmrc.router, prefix=API_V1_PREFIX)

app.include_router(planner.router, prefix=API_V2_PREFIX)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app="main:app", port=8080, reload=True)

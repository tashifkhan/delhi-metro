"""FastAPI application entrypoint.

This module creates the ASGI app, registers routers, and maps service-level
errors to HTTP errors suitable for client integrations.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.dependencies import get_dmrc_client
from app.api.dependencies import get_dmrc_frontend_client
from app.api.router import api_router
from app.core.config import settings
from app.core.errors import UpstreamApiError


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Ensure async HTTP clients are closed on shutdown."""

    yield
    await get_dmrc_client().close()
    await get_dmrc_frontend_client().close()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=settings.app_description,
    debug=settings.debug,
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "health",
            "description": "Operational probes for the API process.",
        },
        {
            "name": "dmrc",
            "description": "Delhi Metro resource and journey planning endpoints.",
        },
    ],
)


@app.exception_handler(UpstreamApiError)
async def handle_upstream_error(
    _: Request,
    exc: UpstreamApiError,
) -> JSONResponse:
    """Translate upstream failures to API-friendly 502 responses."""

    status_code = 502
    if exc.status_code is not None and 400 <= exc.status_code < 500:
        status_code = exc.status_code

    return JSONResponse(
        status_code=status_code,
        content={
            "detail": exc.message,
            "upstream_status_code": exc.status_code,
        },
    )


app.include_router(api_router, prefix="/api/v1")

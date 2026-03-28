"""Reusable FastAPI dependencies.

This module builds and exposes singleton-style service dependencies for routers.
"""

from app.clients.dmrc_client import DmrcApiClient
from app.clients.dmrc_frontend_client import DmrcFrontendClient
from app.services.dmrc_service import DmrcService
from app.services.map_service import MapService

_dmrc_client = DmrcApiClient()
_dmrc_service = DmrcService(_dmrc_client)

_dmrc_frontend_client = DmrcFrontendClient()
_map_service = MapService(_dmrc_frontend_client)


def get_dmrc_service() -> DmrcService:
    """Return application-level DMRC service instance."""

    return _dmrc_service


def get_dmrc_client() -> DmrcApiClient:
    """Return application-level DMRC client instance."""

    return _dmrc_client


def get_map_service() -> MapService:
    """Return application-level map discovery service instance."""

    return _map_service


def get_dmrc_frontend_client() -> DmrcFrontendClient:
    """Return application-level DMRC frontend client instance."""

    return _dmrc_frontend_client

"""NMRC network map asset discovery and delivery.

NMRC publishes one static route map rather than a build manifest, so this
mirrors the DMRC map service's interface over a single known asset.
"""

from __future__ import annotations

import asyncio
import time
from urllib.parse import urljoin

from clients.nmrc import nmrc_client
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from schemas.map_asset import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapAssetType,
    MapFamily,
    MapFormat,
)
from services.nmrc.data import NETWORK_MAP_PATH

ASSET_ID = "nmrc-aqua-network-image"
_CACHE_TTL_SECONDS = 15 * 60
_download_cache: tuple[float, bytes, dict[str, str]] | None = None
_cache_lock: asyncio.Lock | None = None
_cache_lock_loop_id: int | None = None


def _get_cache_lock() -> asyncio.Lock:
    global _cache_lock, _cache_lock_loop_id

    loop_id = id(asyncio.get_running_loop())
    if _cache_lock is None or _cache_lock_loop_id != loop_id:
        _cache_lock = asyncio.Lock()
        _cache_lock_loop_id = loop_id
    return _cache_lock


def _network_map() -> MapAsset:
    return MapAsset(
        id=ASSET_ID,
        family=MapFamily.NETWORK,
        file_type=MapAssetType.IMAGE,
        display_name="NMRC Aqua Line Network Map",
        source_path=NETWORK_MAP_PATH,
        url=urljoin(str(settings.nmrc_base_url), NETWORK_MAP_PATH),
        content_type="image/jpeg",
        content_length=None,
    )


def list_map_assets() -> MapAssetListResponse:
    """List every NMRC map asset, which is the Aqua Line network map alone."""

    return MapAssetListResponse(assets=[_network_map()])


def list_map_assets_by_family(
    *,
    family: MapFamily,
    format_filter: MapFormat,
) -> MapAssetListResponse:
    """List NMRC map assets filtered by family and format."""

    if family is not MapFamily.NETWORK or format_filter is MapFormat.PDF:
        return MapAssetListResponse(assets=[])
    return list_map_assets()


def resolve_primary_assets(family: MapFamily) -> MapAssetByFormatResponse:
    """Resolve the primary image/pdf asset for a family. NMRC has no PDF."""

    if family is not MapFamily.NETWORK:
        return MapAssetByFormatResponse(family=family, image=None, pdf=None)
    return MapAssetByFormatResponse(
        family=MapFamily.NETWORK,
        image=_network_map(),
        pdf=None,
    )


def resolve_asset_for_family(
    *,
    family: MapFamily,
    format_filter: MapFormat,
) -> MapAsset:
    """Resolve one asset for a family and format, or fail with a 404."""

    assets = list_map_assets_by_family(family=family, format_filter=format_filter)
    if not assets.assets:
        raise ApiRequestError(
            message=(
                f"No NMRC map assets found for family '{family.value}'"
                if format_filter is MapFormat.ANY
                else (
                    f"No {format_filter.value} NMRC map asset found for family "
                    f"'{family.value}'"
                )
            ),
            status_code=404,
        )
    return assets.assets[0]


def get_asset_by_id(asset_id: str) -> MapAsset:
    """Find an NMRC map asset by identifier."""

    asset = _network_map()
    if asset_id != asset.id:
        raise ApiRequestError(
            message=f"NMRC map asset not found: {asset_id}",
            status_code=404,
        )
    return asset


async def download_asset(asset: MapAsset) -> tuple[bytes, dict[str, str]]:
    """Download, validate, and briefly cache the bounded NMRC map."""

    global _download_cache

    now = time.monotonic()
    if _download_cache and now - _download_cache[0] < _CACHE_TTL_SECONDS:
        return _download_cache[1], dict(_download_cache[2])

    async with _get_cache_lock():
        now = time.monotonic()
        if _download_cache and now - _download_cache[0] < _CACHE_TTL_SECONDS:
            return _download_cache[1], dict(_download_cache[2])

        content, headers, _url = await nmrc_client.get_bytes(asset.source_path)
        content_type = headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
        if content_type not in {"image/jpeg", "image/jpg"}:
            raise UpstreamApiError(
                f"Unexpected NMRC map content-type '{content_type or 'missing'}'"
            )
        _download_cache = (now, content, dict(headers))
        return content, headers

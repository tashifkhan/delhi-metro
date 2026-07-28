"""Service for discovering and serving DMRC map assets."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from pathlib import PurePosixPath

from clients.frontend import frontend_client
from core.errors import ApiRequestError, UpstreamApiError
from schemas.map_asset import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapAssetType,
    MapFamily,
    MapFormat,
)


@dataclass(frozen=True, slots=True)
class _MapPattern:
    """Filename tokens that identify one map family in the frontend build."""

    family: MapFamily
    label: str
    tokens: tuple[str, ...]


_PATTERNS: tuple[_MapPattern, ...] = (
    _MapPattern(
        family=MapFamily.NETWORK,
        label="DMRC Network Map",
        tokens=(
            "dmrc-nmrc-ncrtc-map",
            "network-map",
            "dmrc-network-map",
            "mapimg",
        ),
    ),
    _MapPattern(
        family=MapFamily.AIRPORT_EXPRESS,
        label="Airport Express Map",
        tokens=("airport-express",),
    ),
    _MapPattern(
        family=MapFamily.RAPID_METRO,
        label="Rapid Metro Map",
        tokens=("rapid-metro",),
    ),
)

_CACHE_TTL_SECONDS = 15 * 60
_asset_cache: tuple[float, MapAssetListResponse] | None = None
_download_cache: dict[str, tuple[float, bytes, dict[str, str]]] = {}
_cache_lock: asyncio.Lock | None = None
_cache_lock_loop_id: int | None = None

_ALLOWED_CONTENT_TYPES: dict[MapAssetType, frozenset[str]] = {
    MapAssetType.IMAGE: frozenset(
        {
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/svg+xml",
        }
    ),
    MapAssetType.PDF: frozenset({"application/pdf"}),
}


def _get_cache_lock() -> asyncio.Lock:
    """Return a map-cache lock bound to the current event loop."""

    global _cache_lock, _cache_lock_loop_id

    loop_id = id(asyncio.get_running_loop())
    if _cache_lock is None or _cache_lock_loop_id != loop_id:
        _cache_lock = asyncio.Lock()
        _cache_lock_loop_id = loop_id
    return _cache_lock


def _pick_file_type(path: str) -> MapAssetType | None:
    ext = PurePosixPath(path).suffix.lower()
    if ext in {".jpg", ".jpeg", ".png", ".svg"}:
        return MapAssetType.IMAGE
    if ext == ".pdf":
        return MapAssetType.PDF
    return None


def _clean_name(path: str) -> str:
    name = PurePosixPath(path).name
    stem = name.rsplit(".", maxsplit=1)[0]
    return stem.replace("-", " ").replace("_", " ").strip()


def _stable_rank(path: str) -> int:
    """Rank candidates so the full-resolution map wins over the preview."""

    lowered = path.lower()
    rank = 0
    if "dmrc-nmrc-ncrtc-map" in lowered:
        rank -= 100
    if "dmrc-network-map" in lowered:
        rank -= 80
    if "mapimg" in lowered:
        rank += 100
    return rank


async def _discover_map_assets() -> MapAssetListResponse:
    files = await frontend_client.get_asset_files()
    assets: list[MapAsset] = []
    seen_paths: set[str] = set()

    for source_key, source_path in files.items():
        lowered_blob = f"{source_key} {source_path}".lower()
        file_type = _pick_file_type(source_path)
        if file_type is None:
            continue

        for pattern in _PATTERNS:
            if not any(token in lowered_blob for token in pattern.tokens):
                continue

            if source_path in seen_paths:
                continue

            status, headers, url = await frontend_client.head(source_path)
            if status >= 400:
                continue

            size_raw = headers.get("content-length")
            size_value = int(size_raw) if size_raw and size_raw.isdigit() else None

            asset_id = (
                f"{pattern.family.value}:{file_type.value}:"
                f"{PurePosixPath(source_path).name}"
            )
            assets.append(
                MapAsset(
                    id=asset_id,
                    family=pattern.family,
                    file_type=file_type,
                    display_name=f"{pattern.label} - {_clean_name(source_path)}",
                    source_path=source_path,
                    url=url,
                    content_type=headers.get("content-type"),
                    content_length=size_value,
                )
            )
            seen_paths.add(source_path)

    assets.sort(
        key=lambda item: (
            item.family.value,
            item.file_type.value,
            _stable_rank(item.source_path),
            -(item.content_length or 0),
            item.source_path,
        )
    )
    return MapAssetListResponse(assets=assets)


async def list_map_assets() -> MapAssetListResponse:
    """Return cached map assets, refreshing metadata at most once per TTL."""

    global _asset_cache

    now = time.monotonic()
    if _asset_cache and now - _asset_cache[0] < _CACHE_TTL_SECONDS:
        return _asset_cache[1].model_copy(deep=True)

    async with _get_cache_lock():
        now = time.monotonic()
        if _asset_cache and now - _asset_cache[0] < _CACHE_TTL_SECONDS:
            return _asset_cache[1].model_copy(deep=True)

        stale = _asset_cache
        try:
            result = await _discover_map_assets()
        except UpstreamApiError:
            if stale is not None:
                return stale[1].model_copy(deep=True)
            raise

        _asset_cache = (now, result)
        return result.model_copy(deep=True)


async def list_map_assets_by_family(
    *,
    family: MapFamily,
    format_filter: MapFormat,
) -> MapAssetListResponse:
    """List map assets filtered by family and file type format."""

    all_assets = await list_map_assets()
    filtered = [asset for asset in all_assets.assets if asset.family == family]
    if format_filter == MapFormat.IMAGE:
        filtered = [a for a in filtered if a.file_type == MapAssetType.IMAGE]
    elif format_filter == MapFormat.PDF:
        filtered = [a for a in filtered if a.file_type == MapAssetType.PDF]
    return MapAssetListResponse(assets=filtered)


async def resolve_primary_assets(family: MapFamily) -> MapAssetByFormatResponse:
    """Resolve the primary image/pdf asset for one map family."""

    assets = await list_map_assets_by_family(
        family=family,
        format_filter=MapFormat.ANY,
    )
    image = next((a for a in assets.assets if a.file_type == MapAssetType.IMAGE), None)
    pdf = next((a for a in assets.assets if a.file_type == MapAssetType.PDF), None)
    return MapAssetByFormatResponse(family=family, image=image, pdf=pdf)


async def resolve_asset_for_family(
    *,
    family: MapFamily,
    format_filter: MapFormat,
) -> MapAsset:
    """Resolve one preferred asset for a family and requested format."""

    if format_filter == MapFormat.ANY:
        assets = await list_map_assets_by_family(
            family=family,
            format_filter=MapFormat.ANY,
        )
        if assets.assets:
            return assets.assets[0]
        raise ApiRequestError(
            message=f"No map assets found for family '{family.value}'",
            status_code=404,
        )

    expected_file_type = (
        MapAssetType.IMAGE if format_filter == MapFormat.IMAGE else MapAssetType.PDF
    )
    assets = await list_map_assets_by_family(
        family=family,
        format_filter=format_filter,
    )
    for asset in assets.assets:
        if asset.file_type == expected_file_type:
            return asset

    raise ApiRequestError(
        message=(
            f"No {format_filter.value} map asset found for family '{family.value}'"
        ),
        status_code=404,
    )


async def get_asset_by_id(asset_id: str) -> MapAsset:
    """Find a discovered asset by stable identifier."""

    assets = await list_map_assets()
    for asset in assets.assets:
        if asset.id == asset_id:
            return asset
    raise ApiRequestError(message=f"Map asset not found: {asset_id}", status_code=404)


async def download_asset(asset: MapAsset) -> tuple[bytes, dict[str, str]]:
    """Download, validate, and briefly cache one bounded map asset."""

    now = time.monotonic()
    cached = _download_cache.get(asset.source_path)
    if cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1], dict(cached[2])

    async with _get_cache_lock():
        now = time.monotonic()
        for path, item in list(_download_cache.items()):
            if now - item[0] >= _CACHE_TTL_SECONDS:
                _download_cache.pop(path, None)
        cached = _download_cache.get(asset.source_path)
        if cached and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1], dict(cached[2])

        content, headers, _url, _status = await frontend_client.get_bytes(
            asset.source_path
        )
        content_type = headers.get("content-type", "").split(";", maxsplit=1)[0].lower()
        if content_type not in _ALLOWED_CONTENT_TYPES[asset.file_type]:
            raise UpstreamApiError(
                f"Unexpected map asset content-type '{content_type or 'missing'}'"
            )

        _download_cache[asset.source_path] = (now, content, dict(headers))
        return content, headers


async def download_asset_by_id(asset_id: str) -> tuple[MapAsset, bytes, dict[str, str]]:
    """Download a map asset by identifier and return metadata + raw bytes."""

    asset = await get_asset_by_id(asset_id)
    content, headers = await download_asset(asset)
    return asset, content, headers

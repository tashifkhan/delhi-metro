"""Service for discovering and serving DMRC map assets."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import PurePosixPath

from clients.frontend import frontend_client
from core.errors import UpstreamApiError
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


async def list_map_assets() -> MapAssetListResponse:
    """Return all map assets discovered from the current frontend build."""

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
        raise UpstreamApiError(
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

    raise UpstreamApiError(
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
    raise UpstreamApiError(message=f"Map asset not found: {asset_id}", status_code=404)


async def download_asset(asset: MapAsset) -> tuple[bytes, dict[str, str]]:
    """Download a resolved map asset's bytes and response headers."""

    content, headers, _url, _status = await frontend_client.get_bytes(
        asset.source_path
    )
    return content, headers


async def download_asset_by_id(asset_id: str) -> tuple[MapAsset, bytes, dict[str, str]]:
    """Download a map asset by identifier and return metadata + raw bytes."""

    asset = await get_asset_by_id(asset_id)
    content, headers = await download_asset(asset)
    return asset, content, headers

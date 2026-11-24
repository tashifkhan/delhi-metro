"""Discover NCRTC maps and serve bounded downloads."""

import asyncio
from urllib.parse import urlsplit

import httpx
from pydantic import AnyHttpUrl, BaseModel, TypeAdapter

from clients.ncrtc import ncrtc_client
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from core.upstream_pacing import pace_request
from schemas.map_asset import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapAssetType,
    MapFamily,
    MapFormat,
)
from services.ncrtc.catalog import JOURNEY

_MAPS = {
    "namoBharatWebMap": ("namo-bharat", "Namo Bharat and Meerut Metro"),
    "dmrcNcrtcMap": ("dmrc-ncrtc", "Delhi Metro and Namo Bharat"),
}
_TYPES = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "svg": "image/svg+xml",
    "webp": "image/webp",
    "pdf": "application/pdf",
}


class MediaFile(BaseModel):
    ext: str
    url: AnyHttpUrl


_media_adapter = TypeAdapter(dict[str, dict[str, list[MediaFile]]])


async def list_map_assets(
    family: MapFamily = MapFamily.NETWORK,
    format_filter: MapFormat = MapFormat.ANY,
) -> MapAssetListResponse:
    if family is not MapFamily.NETWORK:
        return MapAssetListResponse()
    snapshots = await asyncio.gather(
        *(
            ncrtc_client.get(
                f"{JOURNEY}/app-media",
                _media_adapter.validate_python,
                params={"cd": code},
            )
            for code in _MAPS
        ),
        return_exceptions=True,
    )
    if all(isinstance(item, UpstreamApiError) for item in snapshots):
        raise UpstreamApiError("NCRTC maps are unavailable")
    assets = {}
    for (code, (key, title)), snapshot in zip(_MAPS.items(), snapshots, strict=True):
        if isinstance(snapshot, UpstreamApiError):
            continue
        if isinstance(snapshot, BaseException):
            raise snapshot
        for entries in snapshot.data.get(code, {}).values():
            for entry in entries:
                ext = entry.ext.lower()
                if ext not in _TYPES:
                    continue
                kind = MapAssetType.PDF if ext == "pdf" else MapAssetType.IMAGE
                if (
                    format_filter is not MapFormat.ANY
                    and kind.value != format_filter.value
                ):
                    continue
                id_ = f"ncrtc-{key}-{ext}"
                assets.setdefault(
                    id_,
                    MapAsset(
                        id=id_,
                        family=family,
                        file_type=kind,
                        display_name=title,
                        source_path=urlsplit(str(entry.url)).path,
                        url=entry.url,
                        content_type=_TYPES[ext],
                        stale=snapshot.stale,
                        fetched_at=snapshot.fetched_at,
                    ),
                )
    return MapAssetListResponse(assets=list(assets.values()))


async def get_asset_by_id(asset_id: str) -> MapAsset:
    for asset in (await list_map_assets()).assets:
        if asset.id == asset_id:
            return asset
    raise ApiRequestError(f"Unknown NCRTC map asset '{asset_id}'", 404)


async def resolve_primary_assets(family: MapFamily) -> MapAssetByFormatResponse:
    assets = (await list_map_assets(family)).assets
    return MapAssetByFormatResponse(
        family=family,
        image=next(
            (item for item in assets if item.file_type is MapAssetType.IMAGE), None
        ),
        pdf=next((item for item in assets if item.file_type is MapAssetType.PDF), None),
    )


async def resolve_asset_for_family(
    family: MapFamily, format_filter: MapFormat
) -> MapAsset:
    assets = (await list_map_assets(family, format_filter)).assets
    if not assets:
        raise ApiRequestError(f"No NCRTC map available for '{family.value}'", 404)
    return assets[0]


async def download_asset(asset: MapAsset) -> tuple[bytes, dict[str, str]]:
    if asset.url.scheme != "https" or asset.url.host not in {
        "storage.googleapis.com",
        "namobharat.ncrtc.in",
    }:
        raise UpstreamApiError("Unexpected NCRTC map host")
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            await pace_request()
            async with client.stream("GET", str(asset.url)) as response:
                response.raise_for_status()
                content = bytearray()
                async for chunk in response.aiter_bytes():
                    content.extend(chunk)
                    if len(content) > settings.map_download_max_bytes:
                        raise UpstreamApiError(
                            "NCRTC map exceeds the download size limit"
                        )
                return bytes(content), dict(response.headers)
    except httpx.HTTPError as exc:
        raise UpstreamApiError("NCRTC map download failed") from exc

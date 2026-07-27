"""Map asset routes: discovery, metadata, and file delivery."""

from typing import Annotated

from fastapi import APIRouter, Path, Query
from fastapi.responses import RedirectResponse, Response

from schemas.map_asset import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapFamily,
    MapFormat,
)
from services import map_asset as map_service

router = APIRouter(prefix="/dmrc/maps", tags=["maps"])

FamilyPath = Annotated[
    MapFamily,
    Path(description="Map family: network, airport-express, rapid-metro."),
]
FormatQuery = Annotated[
    MapFormat,
    Query(alias="format", description="Response format selector."),
]


@router.get(
    "/assets",
    response_model=MapAssetListResponse,
    summary="List all discovered map assets",
    description=(
        "Reads DMRC frontend `asset-manifest.json` and returns all detected map "
        "assets for network, airport-express, and rapid-metro families."
    ),
)
async def list_map_assets_route() -> MapAssetListResponse:
    """List all discoverable map image/PDF assets."""

    return await map_service.list_map_assets()


@router.get(
    "/assets/{asset_id}",
    response_model=MapAsset,
    summary="Get map asset by id",
    description="Return metadata for a discovered map asset identifier.",
)
async def get_map_asset_route(
    asset_id: Annotated[str, Path(description="Asset id from `/maps/assets` list.")],
) -> MapAsset:
    """Resolve metadata for a map asset id."""

    return await map_service.get_asset_by_id(asset_id)


@router.get(
    "/{family}/assets",
    response_model=MapAssetListResponse,
    summary="List map assets by family",
    description=(
        "Returns map assets for a specific family and optional format filter "
        "(`image`, `pdf`, `any`)."
    ),
)
async def list_map_assets_by_family_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> MapAssetListResponse:
    """List map assets for one map family."""

    return await map_service.list_map_assets_by_family(
        family=family,
        format_filter=format_filter,
    )


@router.get(
    "/{family}",
    response_model=MapAssetByFormatResponse,
    summary="Resolve primary map assets for a family",
    description=(
        "Returns the primary image and PDF candidates for a map family. "
        "For families that currently expose only image, `pdf` is null."
    ),
)
async def get_primary_maps_route(family: FamilyPath) -> MapAssetByFormatResponse:
    """Resolve preferred image/pdf map assets for one family."""

    return await map_service.resolve_primary_assets(family)


@router.get(
    "/{family}/download",
    summary="Redirect to map file URL",
    description=(
        "Resolves a map asset by family+format and issues an HTTP redirect to "
        "the original DMRC static file URL."
    ),
)
async def download_map_redirect_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> RedirectResponse:
    """Redirect callers to the resolved DMRC static asset URL."""

    asset = await map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    return RedirectResponse(url=str(asset.url), status_code=307)


@router.get(
    "/{family}/file",
    summary="Proxy map file bytes",
    description=(
        "Downloads a resolved map file from DMRC and returns raw bytes from this "
        "API with correct content-type and content-disposition headers."
    ),
)
async def download_map_file_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> Response:
    """Proxy a map file via this API for client convenience."""

    asset = await map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    content, headers = await map_service.download_asset(asset)
    media_type = headers.get("content-type", "application/octet-stream")
    filename = asset.source_path.rsplit("/", maxsplit=1)[-1]

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )

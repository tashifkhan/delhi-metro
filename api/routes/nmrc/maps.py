"""NMRC map asset routes: discovery, metadata, and file delivery."""

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
from services.nmrc import map_asset as map_service

router = APIRouter(prefix="/maps", tags=["nmrc"])

FamilyPath = Annotated[
    MapFamily,
    Path(description="Map family. NMRC publishes `network` only."),
]
FormatQuery = Annotated[
    MapFormat,
    Query(alias="format", description="Response format selector."),
]


@router.get(
    "/assets",
    response_model=MapAssetListResponse,
    summary="List NMRC map assets",
    description="Returns every NMRC map asset, currently the Aqua Line network map.",
)
async def list_map_assets_route() -> MapAssetListResponse:
    """List all discoverable NMRC map assets."""

    return map_service.list_map_assets()


@router.get(
    "/assets/{asset_id}",
    response_model=MapAsset,
    summary="Get NMRC map asset by id",
    description="Returns metadata for an NMRC map asset identifier.",
)
async def get_map_asset_route(
    asset_id: Annotated[str, Path(description="Asset id from `/maps/assets` list.")],
) -> MapAsset:
    """Resolve metadata for a map asset id."""

    return map_service.get_asset_by_id(asset_id)


@router.get(
    "/{family}/assets",
    response_model=MapAssetListResponse,
    summary="List NMRC map assets by family",
    description=(
        "Returns NMRC map assets for a family and format filter. NMRC publishes "
        "no PDF, so `format=pdf` returns an empty list."
    ),
)
async def list_map_assets_by_family_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> MapAssetListResponse:
    """List NMRC map assets for one map family."""

    return map_service.list_map_assets_by_family(
        family=family,
        format_filter=format_filter,
    )


@router.get(
    "/{family}",
    response_model=MapAssetByFormatResponse,
    summary="Get the primary NMRC network map",
    description=(
        "Returns the primary image and PDF candidates for a family. NMRC "
        "publishes no PDF, so `pdf` is always null."
    ),
)
async def get_primary_maps_route(family: FamilyPath) -> MapAssetByFormatResponse:
    """Resolve preferred image/pdf map assets for one family."""

    return map_service.resolve_primary_assets(family)


@router.get(
    "/{family}/download",
    response_class=RedirectResponse,
    status_code=307,
    summary="Redirect to the NMRC map file URL",
    description=(
        "Resolves an NMRC map asset and issues an HTTP redirect to the original "
        "static file URL."
    ),
)
async def download_map_redirect_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> RedirectResponse:
    """Redirect callers to the resolved NMRC static asset URL."""

    asset = map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    return RedirectResponse(url=str(asset.url), status_code=307)


@router.get(
    "/{family}/file",
    response_class=Response,
    summary="Proxy the NMRC map file bytes",
    description=(
        "Downloads the resolved NMRC map file and returns raw bytes from this "
        "API with correct content-type and content-disposition headers."
    ),
)
async def download_map_file_route(
    family: FamilyPath,
    format_filter: FormatQuery = MapFormat.ANY,
) -> Response:
    """Proxy an NMRC map file via this API for client convenience."""

    asset = map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    content, headers = await map_service.download_asset(asset)

    return Response(
        content=content,
        media_type=headers.get("content-type", "image/jpeg"),
        headers={
            "Content-Disposition": 'inline; filename="nmrc-aqua-network-map.jpg"',
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
        },
    )

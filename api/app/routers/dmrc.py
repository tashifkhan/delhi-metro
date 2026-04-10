"""DMRC domain routes with fully typed request/response models."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import RedirectResponse, Response

from app.api.dependencies import get_dmrc_service
from app.api.dependencies import get_map_service
from app.schemas.dmrc import (
    FirstLastTrainResponse,
    JourneyFareWithRoute,
    JourneyPlan,
    MetroLine,
    PassengerNotification,
    RouteStrategy,
    StationByLineItem,
    StationDetail,
    StationSearchFilter,
    StationSearchResult,
)
from app.services.dmrc_service import DmrcService
from app.schemas.map_assets import (
    MapAsset,
    MapAssetByFormatResponse,
    MapAssetListResponse,
    MapFamily,
    MapFormat,
)
from app.services.map_service import MapService

router = APIRouter(prefix="/dmrc", tags=["dmrc"])


@router.get(
    "/lines",
    response_model=list[MetroLine],
    summary="List metro lines",
    description=(
        "Returns Delhi Metro line metadata including line code, colors, terminal "
        "stations, and operational status."
    ),
)
async def get_lines(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
) -> list[MetroLine]:
    """Fetch line catalog from DMRC upstream."""

    return await service.get_lines()


@router.get(
    "/notifications",
    response_model=list[PassengerNotification],
    summary="List passenger notifications",
    description=(
        "Returns current DMRC passenger notices that can be displayed as in-app "
        "alerts, banners, or notification feeds."
    ),
)
async def get_notifications(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
) -> list[PassengerNotification]:
    """Fetch current passenger notifications."""

    return await service.get_notifications()


@router.get(
    "/stations/search",
    response_model=list[StationSearchResult],
    summary="Search station by keyword",
    description=(
        "Searches stations by free-text keyword using one of the supported DMRC "
        "search filters (`all`, `least-distance`, `minimum-interchange`)."
    ),
)
async def search_stations(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    query: Annotated[
        str,
        Query(
            min_length=0,
            description=(
                "Station name keyword to search. Empty query returns full station list."
            ),
        ),
    ] = "",
    search_filter: Annotated[
        StationSearchFilter,
        Query(
            alias="filter",
            description="Search behavior mode used by DMRC upstream.",
        ),
    ] = StationSearchFilter.ALL,
) -> list[StationSearchResult]:
    """Return station search results for the given keyword and filter."""

    return await service.station_search(query=query, search_filter=search_filter)


@router.get(
    "/lines/{line_code}/stations",
    response_model=list[StationByLineItem],
    summary="List stations for a line",
    description=(
        "Returns station sequence for a given line code such as `LN3`, `LN10`, "
        "or `LN11`."
    ),
)
async def get_stations_by_line(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    line_code: Annotated[
        str,
        Path(min_length=2, description="DMRC line code, e.g. LN10."),
    ],
) -> list[StationByLineItem]:
    """Fetch ordered line stations by line code."""

    return await service.stations_by_line(line_code=line_code)


@router.get(
    "/stations/{station_code}",
    response_model=StationDetail,
    summary="Get station details",
    description=(
        "Returns rich station details including geolocation, gates, lifts, "
        "platforms, facilities, and linked metro lines."
    ),
)
async def get_station_detail(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    station_code: Annotated[
        str,
        Path(min_length=2, description="DMRC station code, e.g. RG."),
    ],
) -> StationDetail:
    """Fetch detailed station payload for a station code."""

    return await service.station_detail(station_code=station_code)


@router.get(
    "/journeys/fare-route",
    response_model=JourneyFareWithRoute,
    summary="Get fare and route",
    description=(
        "Returns route segments, travel time, and weekday/weekend fare for a "
        "journey pair under a selected optimization strategy."
    ),
)
async def get_fare_with_route(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. VASI."),
    ],
    strategy: Annotated[
        RouteStrategy,
        Query(description="Journey optimization strategy."),
    ] = RouteStrategy.LEAST_DISTANCE,
    journey_time: Annotated[
        datetime | None,
        Query(
            description=(
                "Optional departure datetime (ISO-8601). When provided, uses DMRC "
                "`station_route` timed planning endpoint."
            )
        ),
    ] = None,
) -> JourneyFareWithRoute:
    """Fetch fare and route for one strategy."""

    return await service.journey_fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
        journey_time=journey_time,
    )


@router.get(
    "/journeys/first-last-train",
    response_model=FirstLastTrainResponse,
    summary="Get first and last train timings",
    description=(
        "Returns first and last train timing details for a source/destination "
        "pair under a selected journey strategy."
    ),
)
async def get_first_last_train(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. MVE."),
    ],
    strategy: Annotated[
        RouteStrategy,
        Query(description="Journey optimization strategy."),
    ] = RouteStrategy.LEAST_DISTANCE,
) -> FirstLastTrainResponse:
    """Fetch first/last train timings for one strategy."""

    return await service.first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
    )


@router.get(
    "/journeys/complete",
    response_model=JourneyPlan,
    summary="Get complete journey planning payload",
    description=(
        "Returns both optimization tabs in one response: fare+route and "
        "first/last train for least-distance and minimum-interchange."
    ),
)
async def get_complete_journey_plan(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. VASI."),
    ],
    journey_time: Annotated[
        datetime | None,
        Query(
            description=(
                "Optional departure datetime (ISO-8601). When provided, fare/route "
                "uses timed planning endpoint for both strategies."
            )
        ),
    ] = None,
) -> JourneyPlan:
    """Fetch combined journey payload for both strategy tabs."""

    return await service.complete_journey_plan(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        journey_time=journey_time,
    )


@router.get(
    "/journeys/fare-route/least-distance",
    response_model=JourneyFareWithRoute,
    summary="Get fare route (least distance)",
    description=(
        "Convenience endpoint wrapping journey fare/route with `least-distance` "
        "strategy."
    ),
)
async def get_fare_with_route_least_distance(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. VASI."),
    ],
    journey_time: Annotated[
        datetime | None,
        Query(
            description=(
                "Optional departure datetime (ISO-8601). When provided, uses DMRC "
                "timed planning endpoint."
            )
        ),
    ] = None,
) -> JourneyFareWithRoute:
    """Return least-distance route and fare."""

    return await service.journey_fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.LEAST_DISTANCE,
        journey_time=journey_time,
    )


@router.get(
    "/journeys/fare-route/minimum-interchange",
    response_model=JourneyFareWithRoute,
    summary="Get fare route (minimum interchange)",
    description=(
        "Convenience endpoint wrapping journey fare/route with "
        "`minimum-interchange` strategy."
    ),
)
async def get_fare_with_route_minimum_interchange(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. VASI."),
    ],
    journey_time: Annotated[
        datetime | None,
        Query(
            description=(
                "Optional departure datetime (ISO-8601). When provided, uses DMRC "
                "timed planning endpoint."
            )
        ),
    ] = None,
) -> JourneyFareWithRoute:
    """Return minimum-interchange route and fare."""

    return await service.journey_fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.MINIMUM_INTERCHANGE,
        journey_time=journey_time,
    )


@router.get(
    "/journeys/first-last-train/least-distance",
    response_model=FirstLastTrainResponse,
    summary="Get first/last train (least distance)",
    description=(
        "Convenience endpoint wrapping first/last train with `least-distance` strategy."
    ),
)
async def get_first_last_train_least_distance(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. MVE."),
    ],
) -> FirstLastTrainResponse:
    """Return least-distance first/last train timing details."""

    return await service.first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.LEAST_DISTANCE,
    )


@router.get(
    "/journeys/first-last-train/minimum-interchange",
    response_model=FirstLastTrainResponse,
    summary="Get first/last train (minimum interchange)",
    description=(
        "Convenience endpoint wrapping first/last train with "
        "`minimum-interchange` strategy."
    ),
)
async def get_first_last_train_minimum_interchange(
    service: Annotated[DmrcService, Depends(get_dmrc_service)],
    from_station_code: Annotated[
        str,
        Query(min_length=2, description="Source station code, e.g. RG."),
    ],
    to_station_code: Annotated[
        str,
        Query(min_length=2, description="Destination station code, e.g. MVE."),
    ],
) -> FirstLastTrainResponse:
    """Return minimum-interchange first/last train timing details."""

    return await service.first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.MINIMUM_INTERCHANGE,
    )


@router.get(
    "/maps/assets",
    response_model=MapAssetListResponse,
    summary="List all discovered map assets",
    description=(
        "Reads DMRC frontend `asset-manifest.json` and returns all detected map "
        "assets for network, airport-express, and rapid-metro families."
    ),
)
async def list_map_assets(
    map_service: Annotated[MapService, Depends(get_map_service)],
) -> MapAssetListResponse:
    """List all discoverable map image/PDF assets."""

    return await map_service.list_map_assets()


@router.get(
    "/maps/{family}/assets",
    response_model=MapAssetListResponse,
    summary="List map assets by family",
    description=(
        "Returns map assets for a specific family and optional format filter "
        "(`image`, `pdf`, `any`)."
    ),
)
async def list_map_assets_by_family(
    map_service: Annotated[MapService, Depends(get_map_service)],
    family: Annotated[
        MapFamily,
        Path(description="Map family: network, airport-express, rapid-metro."),
    ],
    format_filter: Annotated[
        MapFormat,
        Query(alias="format", description="Response format selector."),
    ] = MapFormat.ANY,
) -> MapAssetListResponse:
    """List map assets for one map family."""

    return await map_service.list_map_assets_by_family(
        family=family,
        format_filter=format_filter,
    )


@router.get(
    "/maps/{family}",
    response_model=MapAssetByFormatResponse,
    summary="Resolve primary map assets for a family",
    description=(
        "Returns the primary image and PDF candidates for a map family. "
        "For families that currently expose only image, `pdf` is null."
    ),
)
async def get_primary_maps_for_family(
    map_service: Annotated[MapService, Depends(get_map_service)],
    family: Annotated[
        MapFamily,
        Path(description="Map family: network, airport-express, rapid-metro."),
    ],
) -> MapAssetByFormatResponse:
    """Resolve preferred image/pdf map assets for one family."""

    return await map_service.resolve_primary_assets(family)


@router.get(
    "/maps/{family}/download",
    summary="Redirect to map file URL",
    description=(
        "Resolves a map asset by family+format and issues an HTTP redirect to "
        "the original DMRC static file URL."
    ),
)
async def download_map_redirect(
    map_service: Annotated[MapService, Depends(get_map_service)],
    family: Annotated[
        MapFamily,
        Path(description="Map family: network, airport-express, rapid-metro."),
    ],
    format_filter: Annotated[
        MapFormat,
        Query(alias="format", description="Requested file format."),
    ] = MapFormat.ANY,
) -> RedirectResponse:
    """Redirect callers to the resolved DMRC static asset URL."""

    asset = await map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    return RedirectResponse(url=str(asset.url), status_code=307)


@router.get(
    "/maps/{family}/file",
    summary="Proxy map file bytes",
    description=(
        "Downloads a resolved map file from DMRC and returns raw bytes from this "
        "API with correct content-type and content-disposition headers."
    ),
)
async def download_map_file(
    map_service: Annotated[MapService, Depends(get_map_service)],
    family: Annotated[
        MapFamily,
        Path(description="Map family: network, airport-express, rapid-metro."),
    ],
    format_filter: Annotated[
        MapFormat,
        Query(alias="format", description="Requested file format."),
    ] = MapFormat.ANY,
) -> Response:
    """Proxy a map file via this API for client convenience."""

    asset = await map_service.resolve_asset_for_family(
        family=family,
        format_filter=format_filter,
    )
    _, content, headers, _ = await map_service.download_asset_by_id(asset.id)
    media_type = headers.get("content-type", "application/octet-stream")
    filename = asset.source_path.rsplit("/", maxsplit=1)[-1]

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
        },
    )


@router.get(
    "/maps/assets/{asset_id}",
    response_model=MapAsset,
    summary="Get map asset by id",
    description="Return metadata for a discovered map asset identifier.",
)
async def get_map_asset_by_id(
    map_service: Annotated[MapService, Depends(get_map_service)],
    asset_id: Annotated[str, Path(description="Asset id from `/maps/assets` list.")],
) -> MapAsset:
    """Resolve metadata for a map asset id."""

    return await map_service.get_asset_by_id(asset_id)

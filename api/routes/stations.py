"""Station routes."""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from schemas.station import StationDetail, StationSearchFilter, StationSearchResult
from services.station import get_station_detail, search_stations

router = APIRouter(prefix="/dmrc/stations", tags=["stations"])


@router.get(
    "/search",
    response_model=list[StationSearchResult],
    summary="Search station by keyword",
    description=(
        "Searches stations by free-text keyword using one of the supported DMRC "
        "search filters (`all`, `least-distance`, `minimum-interchange`)."
    ),
)
async def search_stations_route(
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

    return await search_stations(query=query, search_filter=search_filter)


@router.get(
    "/{station_code}",
    response_model=StationDetail,
    summary="Get station details",
    description=(
        "Returns rich station details including geolocation, gates, lifts, "
        "platforms, facilities, and linked metro lines."
    ),
)
async def get_station_detail_route(
    station_code: Annotated[
        str,
        Path(min_length=2, description="DMRC station code, e.g. RG."),
    ],
) -> StationDetail:
    """Fetch the detailed station payload for a station code."""

    return await get_station_detail(station_code)

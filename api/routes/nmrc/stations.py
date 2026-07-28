"""NMRC station routes."""

from typing import Annotated

from fastapi import APIRouter, Path, Query

from schemas.station import StationDetail, StationSearchResult
from services.nmrc.station import get_station_detail, search_stations

router = APIRouter(prefix="/stations", tags=["nmrc"])


@router.get(
    "/search",
    response_model=list[StationSearchResult],
    summary="Search NMRC stations",
    description=(
        "Searches the Aqua Line catalog by station name or code substring. "
        "An empty query returns every station."
    ),
)
async def search_stations_route(
    query: Annotated[
        str,
        Query(description="Name or NMRC code substring."),
    ] = "",
) -> list[StationSearchResult]:
    """Return station search results for the given keyword."""

    return await search_stations(query)


@router.get(
    "/{station_code}",
    response_model=StationDetail,
    summary="Get NMRC station details",
    description=(
        "Returns station details including neighbouring stations, platform "
        "directions, and first/last train times in each direction."
    ),
)
async def get_station_detail_route(
    station_code: Annotated[
        str,
        Path(description="NMRC station code, upstream ID, or name, e.g. NM04."),
    ],
) -> StationDetail:
    """Fetch the detailed station payload for a station code."""

    return await get_station_detail(station_code)

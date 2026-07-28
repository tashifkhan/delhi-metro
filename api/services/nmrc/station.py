"""NMRC station search, line listings, and station detail."""

from __future__ import annotations

from core.errors import ApiRequestError
from schemas.station import (
    Platform,
    StationByLineItem,
    StationDetail,
    StationSearchResult,
)
from services.nmrc.catalog import (
    aqua_line,
    aqua_line_badge,
    get_station_catalog,
    resolve_station,
)
from services.nmrc.data import AQUA_LINE_CODE


async def search_stations(query: str = "") -> list[StationSearchResult]:
    """Search the Aqua Line catalog by station name or code substring."""

    normalized_query = query.strip().casefold()
    stations = await get_station_catalog()
    return [
        StationSearchResult(
            id=station.upstream_id,
            station_name=station.name,
            station_code=station.code,
            station_facility=[],
            metro_lines=[aqua_line_badge()],
        )
        for station in stations
        if not normalized_query
        or normalized_query in station.name.casefold()
        or normalized_query in station.code.casefold()
    ]


async def stations_by_line(line_code: str) -> list[StationByLineItem]:
    """Return the ordered station sequence for an NMRC line."""

    if line_code.strip().upper() != AQUA_LINE_CODE:
        raise ApiRequestError("NMRC line was not found", status_code=404)

    stations = await get_station_catalog()
    return [
        StationByLineItem(
            id=station.upstream_id,
            station_name=station.name,
            station_code=station.code,
            station_facility=[],
            metro_lines=[aqua_line_badge()],
            interchange=False,
            status="Normal Service",
        )
        for station in stations
    ]


async def get_station_detail(station_code: str) -> StationDetail:
    """Return station detail assembled from the catalog's neighbours."""

    stations = await get_station_catalog()
    station = resolve_station(station_code, stations)
    index = station.upstream_id - 1
    previous_station = stations[index - 1] if index > 0 else None
    next_station = stations[index + 1] if index + 1 < len(stations) else None

    prev_next: list[dict] = []
    if previous_station:
        prev_next.append(
            {
                "direction": f"Towards {stations[0].name}",
                "station_name": previous_station.name,
                "station_code": previous_station.code,
            }
        )
    if next_station:
        prev_next.append(
            {
                "direction": f"Towards {stations[-1].name}",
                "station_name": next_station.name,
                "station_code": next_station.code,
            }
        )

    platforms = []
    if station.upstream_id != len(stations):
        platforms.append(
            Platform(platform_name="Towards Depot", train_towards=stations[-1].name)
        )
    if station.upstream_id != 1:
        platforms.append(
            Platform(
                platform_name="Towards Sector 51",
                train_towards=stations[0].name,
            )
        )

    return StationDetail(
        id=station.upstream_id,
        station_code=station.code,
        station_name=station.name,
        station_description=(
            "Elevated station on the NMRC Aqua Line between Noida Sector 51 "
            "and Depot Station."
        ),
        station_type="Elevated",
        interchange=False,
        station_status=[],
        metro_lines=[aqua_line()],
        prev_next_stations=prev_next,
        station_facility=[],
        gates=[],
        lifts=[],
        platforms=platforms,
        stations_facilities=[],
        parkings=[],
        nearby_places=[],
        feeder=[],
        first_last_train={
            "towards_depot": {
                "first": station.first_mon_sat_depot,
                "last": station.last_depot,
            },
            "towards_sector_51": {
                "first": station.first_mon_sat_sector_51,
                "last": station.last_sector_51,
            },
        },
    )

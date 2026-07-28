"""NMRC line metadata and the cached station catalog.

The catalog is read from the live journey planner's station selector, and falls
back to the checked-in reference data in `data.py` when the site is
unavailable.
"""

from __future__ import annotations

import logging
import time

from clients.nmrc import nmrc_client
from core.errors import ApiRequestError, UpstreamApiError
from schemas.line import MetroLine, StationLineBadge
from services.nmrc.data import (
    AQUA_COLOR,
    AQUA_LINE_CODE,
    AQUA_LINE_ID,
    AQUA_LINE_NAME,
    STATIONS,
    NmrcStation,
)
from services.nmrc.parsing import parse_station_options

logger = logging.getLogger(__name__)

JOURNEY_PATH = "/Passenger-Information/Journey-Planner-and-Fares"

CACHE_TTL_SECONDS = 15 * 60

_station_cache: tuple[float, tuple[NmrcStation, ...]] | None = None


def aqua_line() -> MetroLine:
    """Return the Aqua Line in the shared `MetroLine` shape."""

    return MetroLine(
        id=AQUA_LINE_ID,
        name=AQUA_LINE_NAME,
        line_color=AQUA_LINE_NAME,
        line_code=AQUA_LINE_CODE,
        primary_color_code=AQUA_COLOR,
        secondary_color_code=None,
        class_primary="aqua",
        class_secondary=None,
        start_station=STATIONS[0].name,
        end_station=STATIONS[-1].name,
        show_in_frontend=True,
        status="Normal Service",
    )


def aqua_line_badge() -> StationLineBadge:
    """Return the station-list badge for the Aqua Line."""

    return StationLineBadge(
        line_id=AQUA_LINE_ID,
        line_code=AQUA_LINE_CODE,
        line_name=AQUA_LINE_NAME,
        # DMRC badges carry the full line label here, e.g. "Yellow Line".
        line_color=AQUA_LINE_NAME,
        primary_color_code=AQUA_COLOR,
    )


async def list_lines() -> list[MetroLine]:
    """Return the NMRC line catalog, which is the Aqua Line alone."""

    return [aqua_line()]


def _with_live_names(options: list[tuple[int, str]]) -> tuple[NmrcStation, ...]:
    """Overlay live station labels onto the checked-in timing data."""

    names = {station_id: name for station_id, name in options}
    return tuple(
        NmrcStation(
            upstream_id=station.upstream_id,
            code=station.code,
            name=names.get(station.upstream_id, station.name),
            first_mon_sat_depot=station.first_mon_sat_depot,
            first_mon_sat_sector_51=station.first_mon_sat_sector_51,
            first_sunday_depot=station.first_sunday_depot,
            first_sunday_sector_51=station.first_sunday_sector_51,
            last_depot=station.last_depot,
            last_sector_51=station.last_sector_51,
        )
        for station in STATIONS
    )


async def get_station_catalog() -> tuple[NmrcStation, ...]:
    """Return the station catalog, refreshed from the live planner page."""

    global _station_cache

    now = time.monotonic()
    if _station_cache and now - _station_cache[0] < CACHE_TTL_SECONDS:
        return _station_cache[1]

    try:
        page = await nmrc_client.get_text(JOURNEY_PATH)
        stations = _with_live_names(parse_station_options(page))
    except (UpstreamApiError, ValueError) as exc:
        logger.warning("Using checked-in NMRC station catalog: %s", exc)
        stations = STATIONS

    _station_cache = (now, stations)
    return stations


def resolve_station(code: str, stations: tuple[NmrcStation, ...]) -> NmrcStation:
    """Resolve an NMRC station code, upstream ID, or name to one station."""

    normalized = code.strip().casefold()
    for station in stations:
        if normalized in {
            station.code.casefold(),
            str(station.upstream_id),
            station.name.casefold(),
        }:
            return station

    # Names the planner has used for stations that the site later renamed.
    aliases = {
        "knowledge park ii": 16,
        "gnoida office": 20,
        "depot": 21,
    }
    if normalized in aliases:
        return stations[aliases[normalized] - 1]

    raise ApiRequestError(f"Unknown NMRC station '{code}'", status_code=404)

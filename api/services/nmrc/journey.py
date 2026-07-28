"""NMRC journey planning.

NMRC's planner is a server-rendered form: an origin/destination pair is
encrypted by the site's own endpoint, then submitted back to the planner page,
whose result section is scraped. When that flow is unavailable, the journey is
derived from the checked-in distance and published fare tables instead, and the
plan reports that in `fallback_reason`.
"""

from __future__ import annotations

import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from clients.nmrc import nmrc_client
from core.errors import ApiRequestError, UpstreamApiError
from schemas.journey import RouteStrategy
from schemas.planner import (
    JourneySource,
    PlannedFare,
    PlannedJourney,
    PlannedLeg,
    PlannedStation,
    PlannedStop,
    ServiceTimes,
)
from services.nmrc.catalog import JOURNEY_PATH, get_station_catalog, resolve_station
from services.nmrc.data import (
    ADJACENT_DISTANCE_KM,
    AQUA_COLOR,
    AQUA_LINE_NAME,
    NmrcStation,
)
from services.nmrc.parsing import parse_journey_page

logger = logging.getLogger(__name__)

DELHI_TIMEZONE = ZoneInfo("Asia/Kolkata")

# Republic Day, Independence Day, and Gandhi Jayanti carry the Sunday fare.
_NATIONAL_HOLIDAYS = {(1, 26), (8, 15), (10, 2)}


def _local_journey_time(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(DELHI_TIMEZONE)
    if value.tzinfo is None:
        # The planner contract documents naive values as Delhi local time.
        return value.replace(tzinfo=DELHI_TIMEZONE)
    return value.astimezone(DELHI_TIMEZONE)


def _is_special_fare_time(journey_time: datetime | None) -> bool:
    value = _local_journey_time(journey_time)
    return value.weekday() == 6 or (value.month, value.day) in _NATIONAL_HOLIDAYS


def _published_fare(station_count: int) -> tuple[float, float]:
    """Return NMRC's published normal/special fare for a station count."""

    if station_count <= 1:
        return 10.0, 10.0
    if station_count == 2:
        return 15.0, 10.0
    if station_count <= 6:
        return 20.0, 15.0
    if station_count <= 9:
        return 30.0, 20.0
    if station_count <= 16:
        return 40.0, 30.0
    return 50.0, 40.0


def _published_distance(origin: NmrcStation, destination: NmrcStation) -> float:
    start = min(origin.upstream_id, destination.upstream_id) - 1
    end = max(origin.upstream_id, destination.upstream_id) - 1
    return round(sum(ADJACENT_DISTANCE_KM[start:end]), 2)


def _service_times(
    origin: NmrcStation,
    destination: NmrcStation,
    journey_time: datetime | None,
) -> ServiceTimes:
    """Return first/last train times for the origin in the travel direction."""

    is_sunday = _local_journey_time(journey_time).weekday() == 6
    towards_depot = destination.upstream_id > origin.upstream_id
    if towards_depot:
        first = origin.first_sunday_depot if is_sunday else origin.first_mon_sat_depot
        last = origin.last_depot
    else:
        first = (
            origin.first_sunday_sector_51
            if is_sunday
            else origin.first_mon_sat_sector_51
        )
        last = origin.last_sector_51
    return ServiceTimes(first=first, last=last)


async def _scrape_journey(
    origin: NmrcStation,
    destination: NmrcStation,
) -> dict[str, object]:
    """Run the planner's encrypt-then-render flow and parse the result."""

    pair = f"{origin.upstream_id}#{destination.upstream_id}"
    encrypted = await nmrc_client.get_json_value(
        "/Captcha/EncryptString",
        params={"EncryptString": pair},
    )
    if not isinstance(encrypted, str) or not encrypted:
        raise UpstreamApiError("NMRC encryption endpoint returned an invalid token")

    page = await nmrc_client.get_text(JOURNEY_PATH, params={"id": encrypted})
    try:
        return parse_journey_page(page)
    except ValueError as exc:
        raise UpstreamApiError(str(exc)) from exc


def _station(station: NmrcStation) -> PlannedStation:
    return PlannedStation(
        name=station.name,
        code=station.code,
        slug=station.name.casefold().replace(" ", "-"),
        legacy_code=None,
        sarthi_code=None,
        status="Normal Service",
    )


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy,
    journey_time: datetime | None = None,
) -> PlannedJourney:
    """Plan one Aqua Line journey in the shared `PlannedJourney` shape."""

    stations = await get_station_catalog()
    origin = resolve_station(from_station_code, stations)
    destination = resolve_station(to_station_code, stations)
    if origin.upstream_id == destination.upstream_id:
        raise ApiRequestError(
            "Origin and destination stations must be different",
            status_code=400,
        )

    station_count = abs(destination.upstream_id - origin.upstream_id)
    step = 1 if destination.upstream_id > origin.upstream_id else -1
    route_stations = [
        stations[index - 1]
        for index in range(
            origin.upstream_id,
            destination.upstream_id + step,
            step,
        )
    ]

    fallback_reason: str | None = None
    try:
        live = await _scrape_journey(origin, destination)
        duration_minutes = float(live["duration_minutes"])
        distance_km = float(live["distance_km"])
        normal_fare = float(live["normal_fare"])
        special_fare = float(live["special_fare"])
        live_stop_names = live["stops"]
        if isinstance(live_stop_names, list) and len(live_stop_names) == len(
            route_stations
        ):
            stops = [PlannedStop(name=str(name)) for name in live_stop_names]
        else:
            stops = [PlannedStop(name=station.name) for station in route_stations]
    except UpstreamApiError as exc:
        fallback_reason = (
            f"NMRC live planner unavailable; used published fare table: {exc}"
        )
        logger.warning("%s", fallback_reason)
        duration_minutes = float(station_count * 2)
        distance_km = _published_distance(origin, destination)
        normal_fare, special_fare = _published_fare(station_count)
        stops = [PlannedStop(name=station.name) for station in route_stations]

    applicable = special_fare if _is_special_fare_time(journey_time) else normal_fare
    duration_label = f"{duration_minutes:g} min"
    towards = stations[-1].name if step > 0 else stations[0].name

    return PlannedJourney(
        source=JourneySource.NMRC,
        fallback_reason=fallback_reason,
        strategy=strategy,
        exclude_airport_line=False,
        origin=_station(origin),
        destination=_station(destination),
        station_count=station_count,
        total_time=duration_label,
        total_distance_km=distance_km,
        fare=PlannedFare(
            normal=normal_fare,
            special=special_fare,
            applicable=applicable,
        ),
        legs=[
            PlannedLeg(
                line_name=AQUA_LINE_NAME,
                line_number=1,
                line_color=AQUA_COLOR,
                from_station=origin.name,
                from_station_code=origin.code,
                to_station=destination.name,
                to_station_code=destination.code,
                station_count=station_count,
                stops=stops,
                duration=duration_label,
                distance_km=distance_km,
                direction="down" if step > 0 else "up",
                platform_name=None,
                towards_station=towards,
                interchange_minutes=0,
            )
        ],
        interchanges=[],
        metro_service=_service_times(origin, destination, journey_time),
        service_available=True,
        ticket_available=False,
    )

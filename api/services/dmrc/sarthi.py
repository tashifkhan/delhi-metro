"""Journey planner service backed by the Delhi Metro Sarthi API.

This is the preferred planner: it reports platform, direction, terminus,
per-leg distance, and a fare breakdown in a single response. It is also an
undocumented vendor API, so `services.planner` always keeps the legacy DMRC
planner behind it.
"""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from clients.sarthi import sarthi_client
from core.catalog import resolve_station, to_sarthi_code
from core.errors import ApiRequestError, UpstreamApiError
from core.validation import validate_model
from schemas.journey import RouteStrategy
from schemas.planner import (
    JourneySource,
    PlannedFare,
    PlannedInterchange,
    PlannedJourney,
    PlannedLeg,
    PlannedStation,
    PlannedStop,
    ServiceTimes,
)
from schemas.sarthi import SarthiJourney, SarthiRouteLeg

DELHI_TIMEZONE = ZoneInfo("Asia/Kolkata")

# The app sends exactly this format; other formats are accepted by the upstream
# but silently produce `serviceStatus: false`.
_JOURNEY_TIME_FORMAT = "%Y-%m-%dT%H:%M"


def _format_journey_time(journey_time: datetime | None) -> str:
    """Format a journey time as Delhi local time in the upstream's format."""

    if journey_time is None:
        return datetime.now(DELHI_TIMEZONE).strftime(_JOURNEY_TIME_FORMAT)

    local_time = journey_time
    if journey_time.tzinfo is not None:
        local_time = journey_time.astimezone(DELHI_TIMEZONE)

    return local_time.strftime(_JOURNEY_TIME_FORMAT)


def _station(code: str, name: str, status: str | None) -> PlannedStation:
    """Build a journey endpoint with its canonical identity attached."""

    canonical = resolve_station(code)
    return PlannedStation(
        name=name,
        code=code,
        slug=canonical.slug if canonical else None,
        legacy_code=canonical.legacy_code if canonical else None,
        sarthi_code=canonical.sarthi_code if canonical else None,
        status=status,
    )


def _leg(raw: SarthiRouteLeg) -> PlannedLeg:
    return PlannedLeg(
        line_name=raw.line,
        line_number=raw.line_no,
        line_color=raw.line_color,
        from_station=raw.start,
        from_station_code=raw.start_code,
        to_station=raw.end,
        to_station_code=raw.end_code,
        station_count=raw.station_count,
        stops=[
            PlannedStop(name=stop.name, status=stop.status or None) for stop in raw.path
        ],
        map_path=list(raw.map_path),
        duration=raw.path_time,
        distance_km=raw.path_distance,
        direction=raw.direction,
        platform_name=raw.platform_name,
        towards_station=raw.towards_station,
        start_time=raw.start_time,
        end_time=raw.end_time,
        interchange_minutes=raw.station_interchange_time,
    )


def normalize(
    journey: SarthiJourney,
    *,
    strategy: RouteStrategy,
    exclude_airport_line: bool,
) -> PlannedJourney:
    """Normalize a raw Sarthi payload into the unified planner model."""

    return PlannedJourney(
        source=JourneySource.SARTHI,
        strategy=strategy,
        exclude_airport_line=exclude_airport_line,
        origin=_station(
            journey.from_code,
            journey.from_station,
            journey.from_station_status.status if journey.from_station_status else None,
        ),
        destination=_station(
            journey.to_code,
            journey.to_station,
            journey.to_station_status.status if journey.to_station_status else None,
        ),
        station_count=journey.stations,
        total_time=journey.total_time,
        total_distance_km=journey.total_distance,
        fare=PlannedFare(
            normal=journey.fare.normal,
            special=journey.fare.special,
            applicable=journey.applicable_fare,
        ),
        legs=[_leg(leg) for leg in journey.routes],
        interchanges=[
            PlannedInterchange(
                station=item.interchange_at,
                minutes=item.interchange_time,
            )
            for item in journey.interchanges
            if item.interchange_at
        ],
        metro_service=(
            ServiceTimes(
                first=journey.metro_time.first,
                last=journey.metro_time.last,
            )
            if journey.metro_time
            else None
        ),
        service_available=journey.service_status,
        ticket_available=journey.ticket_available,
    )


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy = RouteStrategy.LEAST_DISTANCE,
    journey_time: datetime | None = None,
    exclude_airport_line: bool = False,
) -> PlannedJourney:
    """Plan one journey through Sarthi.

    Station codes may be given in either upstream's vocabulary; they are
    translated to Sarthi's codes through the station crosswalk.

    Raises:
        ApiRequestError: If a station code is unknown to the shared catalog.
        UpstreamApiError: If a known station is unavailable in Sarthi, or the
            request fails or returns an unexpected payload.
    """

    from_code = to_sarthi_code(from_station_code)
    to_code = to_sarthi_code(to_station_code)

    # Soorghat is in the legacy catalog only. Failing before the request keeps
    # a known-unplannable journey out of the upstream's generic 500 path.
    if from_code is None or to_code is None:
        missing = from_station_code if from_code is None else to_station_code
        if resolve_station(missing) is not None:
            raise UpstreamApiError(
                message=(
                    f"Station '{missing.strip().upper()}' is unavailable in the "
                    "Sarthi catalog"
                )
            )
        raise ApiRequestError(
            message=f"Station '{missing.strip().upper()}' is not in the Sarthi catalog",
            status_code=404,
        )

    payload = await sarthi_client.get_json_dict(
        f"journey/{from_code}/{to_code}/{strategy.value}/"
        f"{_format_journey_time(journey_time)}",
        params={"exclude_airport_line": str(exclude_airport_line).lower()},
    )
    journey = validate_model(SarthiJourney, payload)

    return normalize(
        journey,
        strategy=strategy,
        exclude_airport_line=exclude_airport_line,
    )

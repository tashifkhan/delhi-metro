"""Service for DMRC journey planning: fares, routes, and train timings."""

from __future__ import annotations

import asyncio
from datetime import datetime

from clients.dmrc import dmrc_client
from core.catalog import resolve_station, to_legacy_code
from core.validation import validate_model
from schemas.journey import (
    FirstLastTrainResponse,
    JourneyFareWithRoute,
    JourneyPlan,
    JourneyRouteSegment,
    RouteStrategy,
)
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
from services.station import normalize_station_code


def _format_journey_time(journey_time: datetime) -> str:
    """Format a datetime for DMRC's `/station_route/.../{timestamp}` path."""

    local_time = journey_time
    if journey_time.tzinfo is not None:
        local_time = journey_time.astimezone().replace(tzinfo=None)

    return local_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3]


async def fare_with_route(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy,
    journey_time: datetime | None = None,
) -> JourneyFareWithRoute:
    """Return route segments, travel time, and fare for one strategy."""

    from_code = normalize_station_code(from_station_code)
    to_code = normalize_station_code(to_station_code)

    if journey_time is None:
        payload = await dmrc_client.get_json_dict(
            f"new_fare_with_route/{from_code}/{to_code}/{strategy.value}/"
        )
    else:
        formatted_time = _format_journey_time(journey_time)
        payload = await dmrc_client.get_json_dict(
            f"station_route/{from_code}/{to_code}/{strategy.value}/{formatted_time}"
        )

        # The timed endpoint returns a single `fare`, unlike the untimed one
        # which splits weekday/weekend.
        if "fare" in payload:
            timed_fare = payload.get("fare")
            payload["weekday_fare"] = timed_fare
            payload["weekend_fare"] = timed_fare

    return validate_model(JourneyFareWithRoute, payload)


async def first_last_train(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy,
) -> FirstLastTrainResponse:
    """Return first/last train timings for one strategy."""

    from_code = normalize_station_code(from_station_code)
    to_code = normalize_station_code(to_station_code)
    payload = await dmrc_client.get_json_dict(
        f"first_and_last_train_with_filter/{from_code}/{to_code}/{strategy.value}/"
    )
    return validate_model(FirstLastTrainResponse, payload)


async def complete_journey_plan(
    *,
    from_station_code: str,
    to_station_code: str,
    journey_time: datetime | None = None,
) -> JourneyPlan:
    """Build the combined payload for both route strategy tabs."""

    (
        least_distance_fare,
        minimum_interchange_fare,
        least_distance_train,
        minimum_interchange_train,
    ) = await asyncio.gather(
        fare_with_route(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=RouteStrategy.LEAST_DISTANCE,
            journey_time=journey_time,
        ),
        fare_with_route(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=RouteStrategy.MINIMUM_INTERCHANGE,
            journey_time=journey_time,
        ),
        first_last_train(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=RouteStrategy.LEAST_DISTANCE,
        ),
        first_last_train(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=RouteStrategy.MINIMUM_INTERCHANGE,
        ),
    )

    return JourneyPlan(
        least_distance_fare=least_distance_fare,
        minimum_interchange_fare=minimum_interchange_fare,
        least_distance_train=least_distance_train,
        minimum_interchange_train=minimum_interchange_train,
    )


def _station(code: str, name: str) -> PlannedStation:
    """Build a journey endpoint with its canonical identity attached."""

    canonical = resolve_station(code)
    return PlannedStation(
        name=name,
        code=code,
        slug=canonical.slug if canonical else None,
        legacy_code=canonical.legacy_code if canonical else None,
        sarthi_code=canonical.sarthi_code if canonical else None,
    )


def _leg(segment: JourneyRouteSegment) -> PlannedLeg:
    return PlannedLeg(
        line_name=segment.line,
        line_number=segment.line_no,
        from_station=segment.start,
        to_station=segment.end,
        station_count=len(segment.path) or None,
        stops=[
            PlannedStop(name=stop.name, status=stop.status or None)
            for stop in segment.path
        ],
        map_path=list(segment.map_path),
        duration=segment.path_time,
        interchange_minutes=segment.station_interchange_time,
    )


def _service_times(trains: FirstLastTrainResponse) -> ServiceTimes | None:
    """Reduce the DMRC first/last train payload to origin service times."""

    first = trains.first_train
    last = trains.last_train
    if first is None and last is None:
        return None

    return ServiceTimes(
        first=(
            first.first_train_route_detail[0].start_time
            if first and first.first_train_route_detail
            else None
        ),
        last=(
            last.last_train_route_detail[0].start_time
            if last and last.last_train_route_detail
            else None
        ),
    )


def normalize(
    fare_route: JourneyFareWithRoute,
    trains: FirstLastTrainResponse | None,
    *,
    strategy: RouteStrategy,
    from_station_code: str,
    to_station_code: str,
) -> PlannedJourney:
    """Normalize DMRC fare/route and train timings into the unified model."""

    return PlannedJourney(
        source=JourneySource.DMRC,
        strategy=strategy,
        # DMRC's planner has no Airport Express exclusion switch.
        exclude_airport_line=False,
        origin=_station(from_station_code, fare_route.from_station),
        destination=_station(to_station_code, fare_route.to_station),
        station_count=fare_route.stations,
        total_time=fare_route.total_time,
        fare=PlannedFare(
            normal=fare_route.weekday_fare,
            special=fare_route.weekend_fare,
        ),
        legs=[_leg(segment) for segment in fare_route.route],
        # Every leg after the first begins at an interchange.
        interchanges=[
            PlannedInterchange(
                station=segment.start,
                minutes=segment.station_interchange_time,
            )
            for segment in fare_route.route[1:]
        ],
        metro_service=_service_times(trains) if trains else None,
    )


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy = RouteStrategy.LEAST_DISTANCE,
    journey_time: datetime | None = None,
) -> PlannedJourney:
    """Plan one journey through the legacy DMRC API.

    Station codes may be given in either upstream's vocabulary; they are
    translated to legacy codes through the station crosswalk.
    """

    from_code = to_legacy_code(from_station_code) or from_station_code
    to_code = to_legacy_code(to_station_code) or to_station_code

    fare_route, trains = await asyncio.gather(
        fare_with_route(
            from_station_code=from_code,
            to_station_code=to_code,
            strategy=strategy,
            journey_time=journey_time,
        ),
        first_last_train(
            from_station_code=from_code,
            to_station_code=to_code,
            strategy=strategy,
        ),
    )

    return normalize(
        fare_route,
        trains,
        strategy=strategy,
        from_station_code=normalize_station_code(from_code),
        to_station_code=normalize_station_code(to_code),
    )

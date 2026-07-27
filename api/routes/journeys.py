"""Journey planning routes: fares, routes, and first/last train timings."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from schemas.journey import (
    FirstLastTrainResponse,
    JourneyFareWithRoute,
    JourneyPlan,
    RouteStrategy,
)
from services.journey import complete_journey_plan, fare_with_route, first_last_train

router = APIRouter(prefix="/dmrc/journeys", tags=["journeys"])

FromStation = Annotated[
    str,
    Query(min_length=2, description="Source station code, e.g. RG."),
]
ToStation = Annotated[
    str,
    Query(min_length=2, description="Destination station code, e.g. VASI."),
]
JourneyTime = Annotated[
    datetime | None,
    Query(
        description=(
            "Optional departure datetime (ISO-8601). When provided, uses DMRC "
            "`station_route` timed planning endpoint."
        )
    ),
]


@router.get(
    "/fare-route",
    response_model=JourneyFareWithRoute,
    summary="Get fare and route",
    description=(
        "Returns route segments, travel time, and weekday/weekend fare for a "
        "journey pair under a selected optimization strategy."
    ),
)
async def fare_with_route_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
    strategy: Annotated[
        RouteStrategy,
        Query(description="Journey optimization strategy."),
    ] = RouteStrategy.LEAST_DISTANCE,
    journey_time: JourneyTime = None,
) -> JourneyFareWithRoute:
    """Fetch fare and route for one strategy."""

    return await fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
        journey_time=journey_time,
    )


@router.get(
    "/fare-route/least-distance",
    response_model=JourneyFareWithRoute,
    summary="Get fare route (least distance)",
    description=(
        "Convenience endpoint wrapping journey fare/route with `least-distance` "
        "strategy."
    ),
)
async def fare_with_route_least_distance_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
    journey_time: JourneyTime = None,
) -> JourneyFareWithRoute:
    """Return least-distance route and fare."""

    return await fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.LEAST_DISTANCE,
        journey_time=journey_time,
    )


@router.get(
    "/fare-route/minimum-interchange",
    response_model=JourneyFareWithRoute,
    summary="Get fare route (minimum interchange)",
    description=(
        "Convenience endpoint wrapping journey fare/route with "
        "`minimum-interchange` strategy."
    ),
)
async def fare_with_route_minimum_interchange_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
    journey_time: JourneyTime = None,
) -> JourneyFareWithRoute:
    """Return minimum-interchange route and fare."""

    return await fare_with_route(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.MINIMUM_INTERCHANGE,
        journey_time=journey_time,
    )


@router.get(
    "/first-last-train",
    response_model=FirstLastTrainResponse,
    summary="Get first and last train timings",
    description=(
        "Returns first and last train timing details for a source/destination "
        "pair under a selected journey strategy."
    ),
)
async def first_last_train_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
    strategy: Annotated[
        RouteStrategy,
        Query(description="Journey optimization strategy."),
    ] = RouteStrategy.LEAST_DISTANCE,
) -> FirstLastTrainResponse:
    """Fetch first/last train timings for one strategy."""

    return await first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
    )


@router.get(
    "/first-last-train/least-distance",
    response_model=FirstLastTrainResponse,
    summary="Get first/last train (least distance)",
    description=(
        "Convenience endpoint wrapping first/last train with `least-distance` strategy."
    ),
)
async def first_last_train_least_distance_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
) -> FirstLastTrainResponse:
    """Return least-distance first/last train timing details."""

    return await first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.LEAST_DISTANCE,
    )


@router.get(
    "/first-last-train/minimum-interchange",
    response_model=FirstLastTrainResponse,
    summary="Get first/last train (minimum interchange)",
    description=(
        "Convenience endpoint wrapping first/last train with "
        "`minimum-interchange` strategy."
    ),
)
async def first_last_train_minimum_interchange_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
) -> FirstLastTrainResponse:
    """Return minimum-interchange first/last train timing details."""

    return await first_last_train(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=RouteStrategy.MINIMUM_INTERCHANGE,
    )


@router.get(
    "/complete",
    response_model=JourneyPlan,
    summary="Get complete journey planning payload",
    description=(
        "Returns both optimization tabs in one response: fare+route and "
        "first/last train for least-distance and minimum-interchange."
    ),
)
async def complete_journey_plan_route(
    from_station_code: FromStation,
    to_station_code: ToStation,
    journey_time: JourneyTime = None,
) -> JourneyPlan:
    """Fetch the combined journey payload for both strategy tabs."""

    return await complete_journey_plan(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        journey_time=journey_time,
    )

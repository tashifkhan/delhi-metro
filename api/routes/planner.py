"""Journey planner routes for the v2 API (Sarthi first, DMRC fallback)."""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from schemas.journey import RouteStrategy
from schemas.planner import JourneySource, MetroNetwork, PlannedJourney
from services.planner import plan_journey

router = APIRouter(prefix="/journeys", tags=["planner"])


@router.get(
    "/plan",
    response_model=PlannedJourney,
    summary="Plan a journey",
    description=(
        "Plans one Metro journey and returns a single normalized payload. The "
        "Delhi Metro Sarthi planner answers by default and adds platform, "
        "direction, terminus, per-leg distance, and fare breakdown; the legacy "
        "delhimetrorail.com planner serves any Sarthi failure. The `source` "
        "field reports which upstream answered and `fallback_reason` is set "
        "when the fallback was used.\n\n"
        "Accepts Delhi Metro station codes in either DMRC vocabulary and station "
        "codes from Noida Metro and NCRTC. For trips across networks, the planner "
        "tries the available walking connections and uses the fastest journey."
    ),
)
async def plan_journey_route(
    from_station_code: Annotated[
        str,
        Query(
            min_length=1,
            max_length=64,
            pattern=r"^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$",
            description=(
                "Origin station code. NMRC also accepts an exact station name."
            ),
        ),
    ],
    to_station_code: Annotated[
        str,
        Query(
            min_length=1,
            max_length=64,
            pattern=r"^[A-Za-z0-9]+(?: [A-Za-z0-9]+)*$",
            description=(
                "Destination station code. NMRC also accepts an exact station name."
            ),
        ),
    ],
    strategy: Annotated[
        RouteStrategy,
        Query(description="Journey optimization strategy."),
    ] = RouteStrategy.LEAST_DISTANCE,
    journey_time: Annotated[
        datetime | None,
        Query(
            description=(
                "Optional departure datetime (ISO-8601), interpreted as Delhi "
                "local time. Affects which fare applies. Defaults to now."
            )
        ),
    ] = None,
    exclude_airport_line: Annotated[
        bool,
        Query(
            description=(
                "Ask the planner to avoid the Airport Express line. Honoured by "
                "Sarthi only; a DMRC fallback plan reports it as not applied."
            )
        ),
    ] = False,
    source: Annotated[
        JourneySource | None,
        Query(
            description=(
                "Pin the plan to one upstream instead of using the fallback "
                "chain. Useful for comparing sources."
            )
        ),
    ] = None,
    network: Annotated[
        MetroNetwork,
        Query(description="Fallback network when neither station code resolves."),
    ] = MetroNetwork.DMRC,
) -> PlannedJourney:
    """Plan one journey through the preferred available upstream."""

    return await plan_journey(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
        journey_time=journey_time,
        exclude_airport_line=exclude_airport_line,
        source=source,
        network=network,
    )

"""Journey planner orchestration across the two planner services.

Sarthi is the preferred source because its response is richer and its routes
come from the same precomputed matrix the official app ships. It is an
undocumented vendor API, so every failure degrades to the legacy DMRC planner
rather than to an error, and the served plan records which source answered.
"""

from __future__ import annotations

import logging
from datetime import datetime

from core.config import settings
from core.errors import UpstreamApiError
from schemas.journey import RouteStrategy
from schemas.planner import JourneySource, PlannedJourney
from services import journey as dmrc_planner
from services import sarthi as sarthi_planner

logger = logging.getLogger(__name__)


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy = RouteStrategy.LEAST_DISTANCE,
    journey_time: datetime | None = None,
    exclude_airport_line: bool = False,
    source: JourneySource | None = None,
) -> PlannedJourney:
    """Plan one journey, preferring Sarthi and falling back to DMRC.

    Args:
        source: Pin the plan to one upstream. When omitted, Sarthi is tried
            first (unless disabled by configuration) and DMRC serves failures.

    Raises:
        UpstreamApiError: If the selected source fails, or if both fail.
    """

    if source is JourneySource.DMRC:
        return await dmrc_planner.plan_journey(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=strategy,
            journey_time=journey_time,
        )

    pinned_to_sarthi = source is JourneySource.SARTHI
    if not pinned_to_sarthi and not settings.sarthi_enabled:
        return await dmrc_planner.plan_journey(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=strategy,
            journey_time=journey_time,
        )

    try:
        return await sarthi_planner.plan_journey(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=strategy,
            journey_time=journey_time,
            exclude_airport_line=exclude_airport_line,
        )
    except UpstreamApiError as exc:
        if pinned_to_sarthi:
            raise

        # Sarthi reports bad input and internal faults alike as a generic 500,
        # so there is nothing here worth retrying against the same upstream.
        logger.warning(
            "sarthi planner failed, falling back to dmrc: %s -> %s (%s): %s",
            from_station_code,
            to_station_code,
            strategy.value,
            exc,
        )
        fallback_reason = str(exc)

    plan = await dmrc_planner.plan_journey(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
        journey_time=journey_time,
    )
    return plan.model_copy(update={"fallback_reason": fallback_reason})

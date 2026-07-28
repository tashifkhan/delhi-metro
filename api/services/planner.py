"""Journey planner orchestration across networks and planner services.

Two independent decisions live here:

1. **Which network(s)** a journey runs on. Station codes are resolved against
   both catalogs, so a journey whose endpoints sit on different networks is
   stitched together through the Sector 52/51 interchange in
   `services.interchange`.
2. **Which upstream** answers the Delhi Metro portion. Sarthi is preferred
   because its response is richer and its routes come from the same
   precomputed matrix the official app ships. It is an undocumented vendor
   API, so every failure degrades to the legacy DMRC planner rather than to an
   error, and the served plan records which source answered.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime

from core.catalog import resolve_station as resolve_dmrc_station
from core.catalog import to_legacy_code
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from schemas.journey import RouteStrategy
from schemas.planner import (
    JourneySource,
    LegKind,
    MetroNetwork,
    NetworkFare,
    PlannedFare,
    PlannedInterchange,
    PlannedJourney,
    PlannedLeg,
    PlannedStation,
)
from services import nmrc as nmrc_planner
from services.dmrc import journey as dmrc_planner
from services.dmrc import sarthi as sarthi_planner
from services.interchange import NetworkInterchange, find_interchange
from services.nmrc.catalog import get_station_catalog as get_nmrc_catalog

logger = logging.getLogger(__name__)

_CLOCK_DURATION = re.compile(r"^\s*(\d+):(\d{2})(?::(\d{2}))?\s*$")
_MINUTES_DURATION = re.compile(r"([\d.]+)\s*min", re.IGNORECASE)


def _duration_minutes(label: str | None) -> float | None:
    """Read a duration label from any upstream into minutes.

    Handles DMRC's `0:38:26`, Sarthi's `31 mins`, and NMRC's `6 min`.
    """

    if not label:
        return None

    clock = _CLOCK_DURATION.match(label)
    if clock:
        hours, minutes, seconds = clock.groups()
        total = int(hours) * 60 + int(minutes) + (int(seconds or 0) / 60)
        return round(total, 1)

    minutes_match = _MINUTES_DURATION.search(label)
    if minutes_match:
        return float(minutes_match.group(1))
    return None


def _format_minutes(total: float) -> str:
    return f"{round(total):g} min"


async def _detect_network(code: str) -> MetroNetwork | None:
    """Resolve which network publishes a station code, if either does."""

    if resolve_dmrc_station(code) is not None:
        return MetroNetwork.DMRC

    normalized = code.strip().casefold()
    for station in await get_nmrc_catalog():
        if normalized in {
            station.code.casefold(),
            str(station.upstream_id),
            station.name.casefold(),
        }:
            return MetroNetwork.NMRC
    return None


async def _canonical_code(code: str, network: MetroNetwork) -> str:
    """Return a station code in its own network's vocabulary."""

    if network is MetroNetwork.DMRC:
        return to_legacy_code(code) or code.strip().upper()

    normalized = code.strip().casefold()
    for station in await get_nmrc_catalog():
        if normalized in {
            station.code.casefold(),
            str(station.upstream_id),
            station.name.casefold(),
        }:
            return station.code
    return code.strip().upper()


async def _plan_on_dmrc(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy,
    journey_time: datetime | None,
    exclude_airport_line: bool,
    source: JourneySource | None,
) -> PlannedJourney:
    """Plan a Delhi Metro journey, preferring Sarthi and falling back to DMRC."""

    if source is JourneySource.DMRC or not settings.sarthi_enabled:
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
        if source is JourneySource.SARTHI:
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


def _stamp_network(plan: PlannedJourney, network: MetroNetwork) -> PlannedJourney:
    """Record the network on a single-network plan and each of its legs."""

    return plan.model_copy(
        update={
            "networks": [network],
            "legs": [
                leg.model_copy(update={"network": network, "source": plan.source})
                for leg in plan.legs
            ],
        }
    )


def _transfer_leg(
    interchange: NetworkInterchange,
    from_network: MetroNetwork,
) -> PlannedLeg:
    """Build the walking leg between the two networks."""

    to_network = (
        MetroNetwork.NMRC if from_network is MetroNetwork.DMRC else MetroNetwork.DMRC
    )
    return PlannedLeg(
        kind=LegKind.TRANSFER,
        network=None,
        walk_metres=interchange.walk_metres,
        note=interchange.note,
        line_name="Walk between networks",
        from_station=interchange.name_for(from_network),
        from_station_code=interchange.code_for(from_network),
        to_station=interchange.name_for(to_network),
        to_station_code=interchange.code_for(to_network),
        station_count=0,
        duration=_format_minutes(interchange.walk_minutes),
        interchange_minutes=interchange.walk_minutes,
    )


def _interchange_station(
    interchange: NetworkInterchange,
    network: MetroNetwork,
) -> PlannedStation:
    """Build a journey endpoint for one side of the interchange."""

    code = interchange.code_for(network)
    canonical = resolve_dmrc_station(code) if network is MetroNetwork.DMRC else None
    return PlannedStation(
        name=interchange.name_for(network),
        code=code,
        slug=canonical.slug if canonical else None,
        legacy_code=canonical.legacy_code if canonical else None,
        sarthi_code=canonical.sarthi_code if canonical else None,
    )


async def _plan_cross_network(
    *,
    from_station_code: str,
    to_station_code: str,
    from_network: MetroNetwork,
    to_network: MetroNetwork,
    strategy: RouteStrategy,
    journey_time: datetime | None,
    exclude_airport_line: bool,
) -> PlannedJourney:
    """Stitch a journey that crosses between the two networks.

    Each half is planned on its own network against the interchange station,
    then joined by a walking leg. Fares are summed because the networks ticket
    separately.
    """

    interchange = find_interchange(from_network, to_network)
    if interchange is None:
        raise ApiRequestError(
            f"No interchange links {from_network.value} and {to_network.value}",
            status_code=400,
        )

    from_code = await _canonical_code(from_station_code, from_network)
    to_code = await _canonical_code(to_station_code, to_network)

    # A traveller already standing at one side of the interchange has no ride
    # on that network, only the walk.
    first_needed = from_code != interchange.code_for(from_network)
    second_needed = to_code != interchange.code_for(to_network)

    async def plan_half(
        network: MetroNetwork,
        origin: str,
        destination: str,
    ) -> PlannedJourney:
        if network is MetroNetwork.NMRC:
            return await nmrc_planner.plan_journey(
                from_station_code=origin,
                to_station_code=destination,
                strategy=strategy,
                journey_time=journey_time,
            )
        return await _plan_on_dmrc(
            from_station_code=origin,
            to_station_code=destination,
            strategy=strategy,
            journey_time=journey_time,
            exclude_airport_line=exclude_airport_line,
            source=None,
        )

    tasks = []
    if first_needed:
        tasks.append(
            plan_half(from_network, from_code, interchange.code_for(from_network))
        )
    if second_needed:
        tasks.append(plan_half(to_network, interchange.code_for(to_network), to_code))

    results: list[PlannedJourney] = list(await asyncio.gather(*tasks))
    first_half = results.pop(0) if first_needed else None
    second_half = results.pop(0) if second_needed else None

    legs: list[PlannedLeg] = []
    interchanges: list[PlannedInterchange] = []
    fare_breakdown: list[NetworkFare] = []
    fallback_reasons: list[str] = []
    total_minutes = float(interchange.walk_minutes)
    station_count = 0
    total_distance: float | None = None

    for half, network in ((first_half, from_network), (second_half, to_network)):
        if half is None:
            continue

        if half is second_half:
            legs.append(_transfer_leg(interchange, from_network))
            interchanges.append(
                PlannedInterchange(
                    station=interchange.name_for(from_network),
                    minutes=interchange.walk_minutes,
                )
            )

        legs.extend(
            leg.model_copy(update={"network": network, "source": half.source})
            for leg in half.legs
        )
        interchanges.extend(half.interchanges)
        station_count += half.station_count
        half_minutes = _duration_minutes(half.total_time)
        if half_minutes is not None:
            total_minutes += half_minutes
        if half.total_distance_km is not None:
            total_distance = (total_distance or 0.0) + half.total_distance_km
        if half.fallback_reason:
            fallback_reasons.append(half.fallback_reason)

        fare_breakdown.append(
            NetworkFare(
                network=network,
                normal=half.fare.normal,
                special=half.fare.special,
                applicable=half.fare.applicable,
            )
        )

    # Both halves skipped means the journey is the interchange walk itself.
    if not legs:
        legs.append(_transfer_leg(interchange, from_network))

    def _sum(values: list[float | None]) -> float | None:
        present = [value for value in values if value is not None]
        return sum(present) if present else None

    return PlannedJourney(
        source=JourneySource.COMBINED,
        networks=[from_network, to_network],
        # Only a journey that actually rides both networks needs two tickets.
        separate_tickets=len(fare_breakdown) > 1,
        fallback_reason="; ".join(fallback_reasons) or None,
        strategy=strategy,
        exclude_airport_line=(
            first_half.exclude_airport_line
            if first_half and from_network is MetroNetwork.DMRC
            else second_half.exclude_airport_line
            if second_half and to_network is MetroNetwork.DMRC
            else False
        ),
        origin=(
            first_half.origin
            if first_half
            else _interchange_station(interchange, from_network)
        ),
        destination=(
            second_half.destination
            if second_half
            else _interchange_station(interchange, to_network)
        ),
        station_count=station_count,
        total_time=_format_minutes(total_minutes),
        total_distance_km=(
            round(total_distance, 3) if total_distance is not None else None
        ),
        fare=PlannedFare(
            normal=sum(item.normal for item in fare_breakdown),
            special=_sum([item.special for item in fare_breakdown]),
            applicable=_sum([item.applicable for item in fare_breakdown]),
            breakdown=fare_breakdown,
        ),
        legs=legs,
        interchanges=interchanges,
        metro_service=first_half.metro_service if first_half else None,
        service_available=all(
            half.service_available is not False
            for half in (first_half, second_half)
            if half is not None
        ),
        ticket_available=False,
    )


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy = RouteStrategy.LEAST_DISTANCE,
    journey_time: datetime | None = None,
    exclude_airport_line: bool = False,
    source: JourneySource | None = None,
    network: MetroNetwork = MetroNetwork.DMRC,
) -> PlannedJourney:
    """Plan one journey, choosing the network(s) and the answering upstream.

    Args:
        source: Pin the Delhi Metro portion to one upstream. When omitted,
            Sarthi is tried first (unless disabled) and DMRC serves failures.
        network: Hint used only when a station code resolves in neither
            catalog. Endpoints that do resolve decide the network themselves,
            including a journey that spans both.

    Raises:
        ApiRequestError: If the network/source combination is invalid.
        UpstreamApiError: If the selected source fails, or if both fail.
    """

    from_network, to_network = await asyncio.gather(
        _detect_network(from_station_code),
        _detect_network(to_station_code),
    )

    if (
        from_network is not None
        and to_network is not None
        and from_network is not to_network
    ):
        if source not in {None, JourneySource.SARTHI, JourneySource.DMRC}:
            raise ApiRequestError(
                f"Source '{source.value}' cannot plan a journey that crosses "
                f"networks",
                status_code=400,
            )
        return await _plan_cross_network(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            from_network=from_network,
            to_network=to_network,
            strategy=strategy,
            journey_time=journey_time,
            exclude_airport_line=exclude_airport_line,
        )

    resolved_network = from_network or to_network or network

    if resolved_network is MetroNetwork.NMRC:
        if source not in {None, JourneySource.NMRC}:
            raise ApiRequestError(
                f"Source '{source.value}' cannot plan an NMRC journey",
                status_code=400,
            )
        plan = await nmrc_planner.plan_journey(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            strategy=strategy,
            journey_time=journey_time,
        )
        return _stamp_network(plan, MetroNetwork.NMRC)

    if source is JourneySource.NMRC:
        raise ApiRequestError(
            "Source 'nmrc' requires an NMRC station",
            status_code=400,
        )

    plan = await _plan_on_dmrc(
        from_station_code=from_station_code,
        to_station_code=to_station_code,
        strategy=strategy,
        journey_time=journey_time,
        exclude_airport_line=exclude_airport_line,
        source=source,
    )
    return _stamp_network(plan, MetroNetwork.DMRC)

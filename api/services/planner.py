"""Plan trips within and across DMRC, NMRC and NCRTC."""

from __future__ import annotations

import asyncio
import logging
import re
from collections import OrderedDict
from datetime import datetime
from itertools import product
from time import monotonic

from core.catalog import resolve_station as resolve_dmrc_station
from core.catalog import to_legacy_code
from core.config import settings
from core.errors import ApiRequestError, UpstreamApiError
from schemas.journey import RouteStrategy
from schemas.planner import (
    FareClass,
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
from services.booking import bookings_for
from services.dmrc import journey as dmrc_planner
from services.dmrc import sarthi as sarthi_planner
from services.interchange import NetworkInterchange, find_interchanges
from services.ncrtc import journey as ncrtc_planner
from services.ncrtc.catalog import STATION_CODES
from services.smart_card import (
    combined_card_fare,
    is_airport_leg,
    local_departure,
    smart_card_fare,
)
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

    if code.strip().upper() in STATION_CODES:
        return MetroNetwork.NCRTC

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
    if network is MetroNetwork.NCRTC:
        return code.strip().upper()

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
            "bookings": bookings_for([network]),
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

    to_network = interchange.other_side(from_network)
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


_CROSS_TTL_SECONDS = 300
_CROSS_CACHE_LIMIT = 256
_cross_cache: OrderedDict[tuple, tuple[float, PlannedJourney]] = OrderedDict()
_cross_pending: dict[tuple, asyncio.Task] = {}


async def _plan_on_network(
    network: MetroNetwork,
    origin: str,
    destination: str,
    strategy: RouteStrategy,
    journey_time: datetime | None,
    exclude_airport_line: bool,
    source: JourneySource | None,
) -> PlannedJourney:
    kwargs = {
        "from_station_code": origin,
        "to_station_code": destination,
        "strategy": strategy,
        "journey_time": journey_time,
    }
    if network is MetroNetwork.NMRC:
        plan = await nmrc_planner.plan_journey(**kwargs)
    elif network is MetroNetwork.NCRTC:
        return await ncrtc_planner.plan_journey(**kwargs)
    else:
        plan = await _plan_on_dmrc(
            **kwargs, exclude_airport_line=exclude_airport_line, source=source
        )
    if plan.fare.smart_card is None:
        plan.fare.smart_card = smart_card_fare(
            plan.fare,
            network,
            journey_time,
            airport_line=any(is_airport_leg(leg) for leg in plan.legs),
        )
    return plan


def _sum_optional(values: list[float | None]) -> float | None:
    present = [value for value in values if value is not None]
    return sum(present) if present else None


async def _plan_cross_network(
    *,
    from_station_code: str,
    to_station_code: str,
    from_network: MetroNetwork,
    to_network: MetroNetwork,
    strategy: RouteStrategy,
    journey_time: datetime | None,
    exclude_airport_line: bool,
    source: JourneySource | None = None,
) -> PlannedJourney:
    from_code, to_code = await asyncio.gather(
        _canonical_code(from_station_code, from_network),
        _canonical_code(to_station_code, to_network),
    )
    departure = local_departure(journey_time)
    key = (
        from_network,
        from_code,
        to_network,
        to_code,
        strategy,
        departure.replace(second=0, microsecond=0)
        if journey_time is not None
        else departure.replace(minute=0, second=0, microsecond=0),
        exclude_airport_line,
        source,
        settings.sarthi_enabled,
    )
    cached = _cross_cache.get(key)
    if cached and monotonic() < cached[0]:
        _cross_cache.move_to_end(key)
        return cached[1]

    async def compute() -> PlannedJourney:
        plan = await _find_fastest(
            from_code,
            to_code,
            from_network,
            to_network,
            strategy,
            journey_time,
            exclude_airport_line,
            source,
        )
        _cross_cache[key] = (monotonic() + _CROSS_TTL_SECONDS, plan)
        _cross_cache.move_to_end(key)
        if len(_cross_cache) > _CROSS_CACHE_LIMIT:
            _cross_cache.popitem(last=False)
        return plan

    task = _cross_pending.get(key)
    if task is None:
        task = asyncio.create_task(compute())
        _cross_pending[key] = task

        def clear_pending(finished: asyncio.Task) -> None:
            _cross_pending.pop(key, None)
            if not finished.cancelled():
                finished.exception()

        task.add_done_callback(clear_pending)
    return await asyncio.shield(task)


async def _find_fastest(
    from_code: str,
    to_code: str,
    from_network: MetroNetwork,
    to_network: MetroNetwork,
    strategy: RouteStrategy,
    journey_time: datetime | None,
    exclude_airport_line: bool,
    source: JourneySource | None,
) -> PlannedJourney:
    networks = [from_network, to_network]
    if MetroNetwork.DMRC not in networks:
        networks.insert(1, MetroNetwork.DMRC)
    connections = [find_interchanges(a, b) for a, b in zip(networks, networks[1:])]
    if not all(connections):
        raise ApiRequestError(
            f"No interchange links {from_network.value} and {to_network.value}",
            400,
        )

    rides: dict[tuple[MetroNetwork, str, str], asyncio.Task[PlannedJourney]] = {}

    async def stitch(
        links: tuple[NetworkInterchange, ...],
    ) -> tuple[float, PlannedJourney]:
        starts = [from_code] + [
            link.code_for(network) for link, network in zip(links, networks[1:])
        ]
        ends = [link.code_for(network) for link, network in zip(links, networks)] + [
            to_code
        ]
        needed = []
        for network, origin, destination in zip(networks, starts, ends, strict=True):
            ride = None
            if origin != destination:
                key = (network, origin, destination)
                if key not in rides:
                    rides[key] = asyncio.create_task(
                        _plan_on_network(
                            network,
                            origin,
                            destination,
                            strategy,
                            journey_time,
                            exclude_airport_line,
                            source,
                        )
                    )
                ride = rides[key]
            needed.append(ride)

        await asyncio.gather(*(ride for ride in needed if ride is not None))
        halves = [ride.result() if ride is not None else None for ride in needed]
        legs = []
        interchanges = []
        fares = []
        fallback_reasons = []
        total_minutes = 0.0
        for index, (half, network) in enumerate(zip(halves, networks, strict=True)):
            if index:
                link = links[index - 1]
                previous_network = networks[index - 1]
                legs.append(_transfer_leg(link, previous_network))
                interchanges.append(
                    PlannedInterchange(
                        station=link.name_for(previous_network),
                        minutes=link.walk_minutes,
                    )
                )
                total_minutes += link.walk_minutes
            if half is None:
                continue
            minutes = _duration_minutes(half.total_time)
            if minutes is None:
                raise UpstreamApiError(
                    f"{network.value} returned an invalid journey duration"
                )
            total_minutes += minutes
            legs.extend(
                leg.model_copy(update={"network": network, "source": half.source})
                for leg in half.legs
            )
            interchanges.extend(half.interchanges)
            fares.append(
                NetworkFare(
                    network=network,
                    normal=half.fare.normal,
                    special=half.fare.special,
                    applicable=half.fare.applicable,
                )
            )
            if half.fallback_reason:
                fallback_reasons.append(half.fallback_reason)

        planned = [half for half in halves if half is not None]
        normal = sum(fare.normal for fare in fares)
        applicable = _sum_optional([fare.applicable for fare in fares])
        special = _sum_optional([fare.special for fare in fares])
        rail_fare = next(
            (half.fare for half in planned if half.source is JourneySource.NCRTC), None
        )
        classes = []
        if rail_fare is not None:
            other_amount = normal - rail_fare.normal
            classes = [
                FareClass.model_validate(
                    {"class": item.name, "amount": item.amount + other_amount}
                )
                for item in rail_fare.classes
            ]
            if applicable is not None:
                applicable = sum(
                    fare.applicable if fare.applicable is not None else fare.normal
                    for fare in fares
                )
            if special is not None:
                special = sum(
                    fare.special if fare.special is not None else fare.normal
                    for fare in fares
                )
        distance = _sum_optional([half.total_distance_km for half in planned])
        return total_minutes, PlannedJourney(
            source=JourneySource.COMBINED,
            networks=networks,
            separate_tickets=len(fares) > 1,
            fallback_reason="; ".join(fallback_reasons) or None,
            strategy=strategy,
            exclude_airport_line=any(half.exclude_airport_line for half in planned),
            origin=halves[0].origin
            if halves[0]
            else _interchange_station(links[0], from_network),
            destination=halves[-1].destination
            if halves[-1]
            else _interchange_station(links[-1], to_network),
            station_count=sum(half.station_count for half in planned),
            total_time=_format_minutes(total_minutes),
            total_distance_km=round(distance, 3) if distance is not None else None,
            fare=PlannedFare(
                normal=normal,
                special=special,
                applicable=applicable,
                breakdown=fares,
                classes=classes,
                smart_card=combined_card_fare(
                    [half.fare for half in planned], local_departure(journey_time)
                ),
            ),
            legs=legs,
            interchanges=interchanges,
            metro_service=halves[0].metro_service if halves[0] else None,
            service_available=all(
                half.service_available is not False for half in planned
            ),
            ticket_available=False,
            bookings=bookings_for(networks),
        )

    outcomes = await asyncio.gather(
        *(stitch(links) for links in product(*connections)),
        return_exceptions=True,
    )
    for outcome in outcomes:
        if isinstance(outcome, BaseException) and not isinstance(
            outcome, (ApiRequestError, UpstreamApiError)
        ):
            raise outcome
    plans = [outcome for outcome in outcomes if not isinstance(outcome, BaseException)]
    if plans:
        return min(plans, key=lambda item: item[0])[1]
    raise outcomes[0]


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
    from_network, to_network = await asyncio.gather(
        _detect_network(from_station_code),
        _detect_network(to_station_code),
    )
    if from_network and to_network and from_network is not to_network:
        if source not in {None, JourneySource.SARTHI, JourneySource.DMRC}:
            raise ApiRequestError(
                f"Source '{source.value}' cannot plan a journey that crosses networks",
                400,
            )
        return await _plan_cross_network(
            from_station_code=from_station_code,
            to_station_code=to_station_code,
            from_network=from_network,
            to_network=to_network,
            strategy=strategy,
            journey_time=journey_time,
            exclude_airport_line=exclude_airport_line,
            source=source,
        )

    resolved_network = from_network or to_network or network
    allowed = {
        MetroNetwork.DMRC: {None, JourneySource.SARTHI, JourneySource.DMRC},
        MetroNetwork.NMRC: {None, JourneySource.NMRC},
        MetroNetwork.NCRTC: {None, JourneySource.NCRTC},
    }
    if source not in allowed[resolved_network]:
        raise ApiRequestError(
            f"Source '{source.value}' cannot plan a {resolved_network.value} journey",
            400,
        )
    plan = await _plan_on_network(
        resolved_network,
        from_station_code,
        to_station_code,
        strategy,
        journey_time,
        exclude_airport_line,
        source,
    )
    return _stamp_network(plan, resolved_network)

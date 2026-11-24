"""Plan NCRTC trips from published running times and service stops."""

import asyncio
from datetime import datetime

from pydantic import BaseModel, Field, TypeAdapter

from clients.ncrtc import ncrtc_client
from core.errors import ApiRequestError, UpstreamApiError
from schemas.journey import RouteStrategy
from schemas.planner import (
    JourneySource,
    MetroNetwork,
    PlannedFare,
    PlannedInterchange,
    PlannedJourney,
    PlannedLeg,
    PlannedStation,
    PlannedStop,
)
from services.ncrtc.catalog import (
    JOURNEY,
    LINES,
    MEERUT_CODES,
    NAMO_BHARAT_MEERUT_STOPS,
    Station,
    stations,
)
from services.ncrtc.fare import Measurement, get_fare

MEERUT_CHANGE_MINUTES = 4  # Estimated platform change at a shared station.
DUHAI_CHANGE_MINUTES = 4  # Estimated change between NCRTC main and spur trains.


class HopStop(BaseModel):
    code: str
    time: Measurement


class RouteStop(BaseModel):
    stationInfo: HopStop


class RouteInfo(BaseModel):
    routeInfo: list[RouteStop] = Field(min_length=2)


_routes = TypeAdapter(list[RouteInfo])


async def route_stops(origin: Station, destination: Station) -> list[HopStop]:
    """Return physical stops with seconds from the preceding stop."""

    def parse(payload: object) -> list[HopStop]:
        for route in _routes.validate_python(payload):
            stops = [item.stationInfo for item in route.routeInfo]
            if (
                stops[0].code == origin.code
                and stops[-1].code == destination.code
                and all(stop.time.unit == "s" for stop in stops)
            ):
                return stops
        raise ValueError("NCRTC route did not match its requested endpoints and units")

    snapshot = await ncrtc_client.get(
        f"{JOURNEY}/routes/info",
        parse,
        params={"fst": origin.id, "tst": destination.id},
    )
    return snapshot.data


def _express_stop(code: str) -> bool:
    return code not in MEERUT_CODES or code in NAMO_BHARAT_MEERUT_STOPS


def _leg_ranges(codes: list[str]) -> list[tuple[int, int, int]]:
    """Return line index and inclusive stop indexes for each ride."""

    last = len(codes) - 1
    if "AS2" in {codes[0], codes[last]} and "A07" in codes:
        duhai = codes.index("A06")
        first = _leg_ranges(codes[: duhai + 1])
        second = [
            (line, start + duhai, end + duhai)
            for line, start, end in _leg_ranges(codes[duhai:])
        ]
        return first + second
    if _express_stop(codes[0]) and _express_stop(codes[last]):
        return [(0, 0, last)]
    if codes[0] in MEERUT_CODES and codes[last] in MEERUT_CODES:
        return [(1, 0, last)]
    shared = [
        index for index, code in enumerate(codes) if code in NAMO_BHARAT_MEERUT_STOPS
    ]
    if not shared:
        raise UpstreamApiError(
            "NCRTC route is missing a Namo Bharat to Meerut Metro interchange"
        )
    if _express_stop(codes[0]):
        change = shared[-1]
        return [(0, 0, change), (1, change, last)]
    change = shared[0]
    return [(1, 0, change), (0, change, last)]


def _clock(seconds: float) -> str:
    minutes, seconds = divmod(round(seconds), 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02}:{minutes:02}:{seconds:02}"


def planned_station(station: Station) -> PlannedStation:
    return PlannedStation(code=station.code, name=station.name, status="Normal Service")


async def plan_journey(
    *,
    from_station_code: str,
    to_station_code: str,
    strategy: RouteStrategy,
    journey_time: datetime | None = None,
) -> PlannedJourney:
    catalog = {item.code: item for item in await stations()}
    origin = catalog.get(from_station_code.strip().upper())
    destination = catalog.get(to_station_code.strip().upper())
    if origin is None or destination is None:
        missing = from_station_code if origin is None else to_station_code
        raise ApiRequestError(f"Unknown NCRTC station '{missing}'", 404)
    if origin == destination:
        raise ApiRequestError("Origin and destination stations must be different", 400)

    physical, fare = await asyncio.gather(
        route_stops(origin, destination), get_fare(origin, destination)
    )
    codes = [item.code for item in physical]
    if any(code not in catalog for code in codes):
        raise UpstreamApiError(
            "NCRTC route contains a station missing from the catalog"
        )

    legs = []
    interchanges = []
    for line_index, start, end in _leg_ranges(codes):
        line = LINES[line_index]
        stop_codes = [
            code
            for code in codes[start : end + 1]
            if line_index == 1 or _express_stop(code)
        ]
        seconds = sum(item.time.value for item in physical[start + 1 : end + 1])
        change_minutes = None
        if legs:
            change_minutes = (
                DUHAI_CHANGE_MINUTES if codes[start] == "A06" else MEERUT_CHANGE_MINUTES
            )
            interchanges.append(
                PlannedInterchange(
                    station=catalog[stop_codes[0]].name,
                    minutes=change_minutes,
                )
            )
        legs.append(
            PlannedLeg(
                network=MetroNetwork.NCRTC,
                source=JourneySource.NCRTC,
                line_name=line.name,
                line_number=line.id,
                line_color=line.primary_color_code,
                from_station=catalog[stop_codes[0]].name,
                from_station_code=stop_codes[0],
                to_station=catalog[stop_codes[-1]].name,
                to_station_code=stop_codes[-1],
                station_count=len(stop_codes) - 1,
                stops=[PlannedStop(name=catalog[code].name) for code in stop_codes],
                map_path=[
                    f"{a}-{b}"
                    for a, b in zip(codes[start:end], codes[start + 1 : end + 1])
                ],
                duration=_clock(seconds),
                interchange_minutes=change_minutes,
            )
        )

    classes = fare.classes_for(any(leg.line_number == LINES[0].id for leg in legs))
    total_seconds = sum(item.time.value for item in physical[1:]) + 60 * sum(
        change.minutes for change in interchanges
    )
    return PlannedJourney(
        source=JourneySource.NCRTC,
        networks=[MetroNetwork.NCRTC],
        strategy=strategy,
        exclude_airport_line=False,
        origin=planned_station(origin),
        destination=planned_station(destination),
        station_count=sum(leg.station_count for leg in legs),
        total_time=_clock(total_seconds),
        total_distance_km=fare.tripSummary.distance.value / 1000,
        fare=PlannedFare(normal=classes[0].amount, classes=classes),
        legs=legs,
        interchanges=interchanges,
    )

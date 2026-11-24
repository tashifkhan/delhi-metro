"""NCRTC station identities and line membership."""

from collections.abc import MutableMapping
from datetime import datetime

from pydantic import BaseModel, Field, TypeAdapter

from clients.ncrtc import Snapshot, ncrtc_client
from core.errors import ApiRequestError
from schemas.line import MetroLine, StationLineBadge
from schemas.station import StationByLineItem

JOURNEY = "/commons/journey"
STATION_CODES = frozenset(["Z00", "AS2", *(f"A{i:02}" for i in range(1, 22))])
# Unverified until a full-day capture. A13 was observed during the short capture.
NAMO_BHARAT_MEERUT_STOPS = frozenset({"A10", "A13", "A17", "A21"})
MEERUT_CODES = frozenset(f"A{i:02}" for i in range(10, 22))
LINES = (
    MetroLine(
        id=1,
        name="Namo Bharat",
        line_code="RRTS",
        line_color="Orange",
        primary_color_code="#E86E25",
        class_primary="rrts",
        start_station="Sarai Kale Khan",
        end_station="Modipuram",
        status="Operational",
    ),
    MetroLine(
        id=2,
        name="Meerut Metro",
        line_code="MRTS",
        line_color="Blue",
        primary_color_code="#2955A5",
        class_primary="mrts",
        start_station="Meerut South",
        end_station="Modipuram",
        status="Operational",
    ),
)


class Station(BaseModel):
    id: int
    code: str
    name: str = Field(min_length=1)
    order: int
    latitude: float | None = None
    longitude: float | None = None


def parse_stations(payload):
    stations = TypeAdapter(list[Station]).validate_python(payload)
    if {station.code for station in stations} != STATION_CODES or len(stations) != len(
        STATION_CODES
    ):
        raise ValueError("Empty or duplicate NCRTC station catalog")
    if any(not station.name.strip() for station in stations):
        raise ValueError("NCRTC station catalog is missing names")
    return sorted(stations, key=lambda station: station.order)


async def station_snapshot():
    return await ncrtc_client.get(f"{JOURNEY}/stations", parse_stations, retry=True)


async def stations() -> list[Station]:
    return (await station_snapshot()).data


async def resolve(code):
    for station in await stations():
        if station.code == code.strip().upper():
            return station
    raise ApiRequestError(f"Unknown NCRTC station '{code}'", 404)


def lines_for(code):
    return list(LINES if code in MEERUT_CODES else LINES[:1])


class NCRTCStationByLineItem(StationByLineItem):
    stale: bool
    fetched_at: datetime


def station_item(station: Station, snapshot: Snapshot) -> NCRTCStationByLineItem:
    return NCRTCStationByLineItem(
        stale=snapshot.stale,
        fetched_at=snapshot.fetched_at,
        id=station.id,
        station_code=station.code,
        station_name=station.name,
        status="Operational",
        interchange=station.code in NAMO_BHARAT_MEERUT_STOPS,
        metro_lines=[
            StationLineBadge(
                line_id=line.id,
                line_code=line.line_code,
                line_name=line.name,
                line_color=line.line_color,
                primary_color_code=line.primary_color_code,
            )
            for line in lines_for(station.code)
        ],
    )


async def search(
    query: str = "",
    line_code: str | None = None,
    response_headers: MutableMapping[str, str] | None = None,
) -> list[NCRTCStationByLineItem]:
    line_code = line_code.upper() if line_code else None
    if line_code and line_code not in {line.line_code for line in LINES}:
        raise ApiRequestError(f"Unknown NCRTC line '{line_code}'", 404)
    query = query.strip().casefold()
    snapshot = await station_snapshot()
    if response_headers is not None:
        response_headers["X-NCRTC-Stale"] = str(snapshot.stale).lower()
        response_headers["X-NCRTC-Fetched-At"] = snapshot.fetched_at.isoformat()
    return [
        station_item(station, snapshot)
        for station in snapshot.data
        if (
            not line_code
            or line_code in {line.line_code for line in lines_for(station.code)}
        )
        and (query in station.name.casefold() or query in station.code.casefold())
    ]


async def stations_by_line(line_code: str) -> list[NCRTCStationByLineItem]:
    return await search(line_code=line_code)
